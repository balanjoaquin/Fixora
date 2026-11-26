<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\TechnicianProfile;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class TechnicianSearchService
{
    private const EARTH_RADIUS_KM = 6371.0;

    /** @var array<string, array<int, array<int, string>>> */
    private static array $fullTextIndexesCache = [];

    /**
     * Busca técnicos visibles y activos aplicando filtros combinables.
     *
     * @param array{
     *     specialty_id?: int|null,
     *     specialty?: string|null,
     *     q?: string|null,
     *     zone?: string|null,
     *     lat?: float|string|null,
     *     lng?: float|string|null,
     *     radius_km?: float|int|string|null,
     *     available_on?: string|null,
     *     available_at?: string|null,
     *     sort?: string|null,
     *     per_page?: int|null
     * } $filters
     */
    public function search(array $filters): LengthAwarePaginator
    {
        $hasCoordinates = isset($filters['lat'], $filters['lng'])
            && $filters['lat'] !== null
            && $filters['lng'] !== null;

        $lat = $hasCoordinates ? (float) $filters['lat'] : null;
        $lng = $hasCoordinates ? (float) $filters['lng'] : null;
        $radiusKm = $hasCoordinates ? (float) ($filters['radius_km'] ?? 10.0) : null;

        $query = TechnicianProfile::query()
            ->select('technician_profiles.*')
            ->join('users', 'users.id', '=', 'technician_profiles.user_id')
            ->where('technician_profiles.is_visible', true)
            ->where('users.status', UserStatus::Active->value)
            ->where('users.role', UserRole::Technician->value)
            ->with([
                'user:id,name',
                'specialties' => static fn ($q) => $q
                    ->where('specialties.is_active', true)
                    ->orderBy('specialties.id'),
            ]);

        if (!empty($filters['specialty_id'])) {
            $specialtyId = (int) $filters['specialty_id'];
            $query->whereHas('specialties', static function (Builder $q) use ($specialtyId): void {
                $q->where('specialties.id', $specialtyId)
                    ->where('specialties.is_active', true);
            });
        }

        if (!empty($filters['specialty'])) {
            $specialtySlug = trim((string) $filters['specialty']);
            $query->whereHas('specialties', static function (Builder $q) use ($specialtySlug): void {
                $q->where('specialties.slug', $specialtySlug)
                    ->where('specialties.is_active', true);
            });
        }

        if (!empty($filters['q'])) {
            $this->applyTextSearch($query, trim((string) $filters['q']));
        }

        if (!empty($filters['zone'])) {
            $escapedZone = $this->escapeLike(trim((string) $filters['zone']));
            $query->where('technician_profiles.service_zone', 'LIKE', "%{$escapedZone}%");
        }

        if ($hasCoordinates && $lat !== null && $lng !== null && $radiusKm !== null) {
            $this->applyProximityFilter($query, $lat, $lng, $radiusKm);
        }

        if (!empty($filters['available_on'])) {
            $this->applyAvailabilityFilter(
                $query,
                (string) $filters['available_on'],
                isset($filters['available_at']) ? (string) $filters['available_at'] : null,
            );
        }

        $sort = $filters['sort'] ?? ($hasCoordinates ? 'distance' : 'rating');
        $this->applySorting($query, (string) $sort, $hasCoordinates);

        $perPage = (int) ($filters['per_page'] ?? 12);

        return $query->paginate($perPage);
    }

    /**
     * Obtiene el perfil público de un técnico visible y activo, o lanza 404.
     */
    public function findPublicProfile(int $profileId): TechnicianProfile
    {
        return TechnicianProfile::query()
            ->whereKey($profileId)
            ->where('is_visible', true)
            ->whereHas('user', static function (Builder $q): void {
                $q->where('status', UserStatus::Active->value)
                    ->where('role', UserRole::Technician->value);
            })
            ->with([
                'user:id,name',
                'specialties' => static fn ($q) => $q
                    ->where('specialties.is_active', true)
                    ->orderBy('specialties.id'),
                'services' => static fn ($q) => $q
                    ->where('is_active', true)
                    ->orderBy('id'),
                'availabilitySlots' => static fn ($q) => $q
                    ->orderBy('weekday')
                    ->orderBy('start_time'),
            ])
            ->firstOrFail();
    }

    private function applyTextSearch(Builder $query, string $term): void
    {
        $length = mb_strlen($term);
        $escapedLike = '%' . $this->escapeLike($term) . '%';
        $hasWildcardChars = str_contains($term, '%') || str_contains($term, '_');
        $booleanQuery = $length >= 3 ? $this->buildBooleanFullTextQuery($term) : null;
        $inOpenTransaction = DB::transactionLevel() > 0;

        $profileFtCols = $booleanQuery !== null ? $this->findFullTextColumns('technician_profiles', 'headline') : null;
        $serviceFtCols = $booleanQuery !== null ? $this->findFullTextColumns('technician_services', 'title') : null;

        $query->where(static function (Builder $outer) use (
            $escapedLike,
            $hasWildcardChars,
            $booleanQuery,
            $inOpenTransaction,
            $profileFtCols,
            $serviceFtCols
        ): void {
            // Coincidencia en technician_profiles.headline
            $outer->where(static function (Builder $profileMatch) use (
                $escapedLike,
                $hasWildcardChars,
                $booleanQuery,
                $inOpenTransaction,
                $profileFtCols
            ): void {
                if ($booleanQuery !== null && $profileFtCols !== null) {
                    $colsSql = implode(', ', array_map(
                        static fn (string $col): string => "technician_profiles.{$col}",
                        $profileFtCols
                    ));

                    if ($inOpenTransaction) {
                        $profileMatch->whereRaw("MATCH({$colsSql}) AGAINST (? IN BOOLEAN MODE)", [$booleanQuery])
                            ->orWhere('technician_profiles.headline', 'LIKE', $escapedLike);
                    } else {
                        $profileMatch->whereRaw("MATCH({$colsSql}) AGAINST (? IN BOOLEAN MODE)", [$booleanQuery]);
                        if ($hasWildcardChars) {
                            $profileMatch->where('technician_profiles.headline', 'LIKE', $escapedLike);
                        }
                    }
                } else {
                    $profileMatch->where('technician_profiles.headline', 'LIKE', $escapedLike);
                }
            })
            // Coincidencia en technician_services.title o description de servicios activos
            ->orWhereExists(static function ($sub) use (
                $escapedLike,
                $hasWildcardChars,
                $booleanQuery,
                $inOpenTransaction,
                $serviceFtCols
            ): void {
                $sub->selectRaw('1')
                    ->from('technician_services')
                    ->whereColumn('technician_services.technician_profile_id', 'technician_profiles.id')
                    ->where('technician_services.is_active', true);

                if ($booleanQuery !== null && $serviceFtCols !== null) {
                    $colsSql = implode(', ', array_map(
                        static fn (string $col): string => "technician_services.{$col}",
                        $serviceFtCols
                    ));

                    if ($inOpenTransaction) {
                        $sub->where(static function ($serviceText) use ($colsSql, $booleanQuery, $escapedLike): void {
                            $serviceText->whereRaw("MATCH({$colsSql}) AGAINST (? IN BOOLEAN MODE)", [$booleanQuery])
                                ->orWhere('technician_services.title', 'LIKE', $escapedLike)
                                ->orWhere('technician_services.description', 'LIKE', $escapedLike);
                        });
                    } else {
                        $sub->whereRaw("MATCH({$colsSql}) AGAINST (? IN BOOLEAN MODE)", [$booleanQuery]);
                        if ($hasWildcardChars) {
                            $sub->where(static function ($serviceLike) use ($escapedLike): void {
                                $serviceLike->where('technician_services.title', 'LIKE', $escapedLike)
                                    ->orWhere('technician_services.description', 'LIKE', $escapedLike);
                            });
                        }
                    }
                } else {
                    $sub->where(static function ($serviceLike) use ($escapedLike): void {
                        $serviceLike->where('technician_services.title', 'LIKE', $escapedLike)
                            ->orWhere('technician_services.description', 'LIKE', $escapedLike);
                    });
                }
            });
        });
    }

    private function applyProximityFilter(Builder $query, float $lat, float $lng, float $radiusKm): void
    {
        $latDelta = rad2deg($radiusKm / self::EARTH_RADIUS_KM);
        $cosLat = max(abs(cos(deg2rad($lat))), 0.0001);
        $lngDelta = rad2deg($radiusKm / (self::EARTH_RADIUS_KM * $cosLat));

        // Margen de 1% en el bounding box para aprovechar el índice compuesto antes del corte esférico exacto
        $latMargin = $latDelta * 1.01;
        $lngMargin = $lngDelta * 1.01;

        $radiusMeters = $radiusKm * 1000.0;

        $query
            ->whereNotNull('technician_profiles.latitude')
            ->whereNotNull('technician_profiles.longitude')
            ->whereBetween('technician_profiles.latitude', [$lat - $latMargin, $lat + $latMargin])
            ->whereBetween('technician_profiles.longitude', [$lng - $lngMargin, $lng + $lngMargin])
            ->selectRaw(
                'ST_Distance_Sphere(POINT(technician_profiles.longitude, technician_profiles.latitude), POINT(?, ?)) AS distance_meters',
                [$lng, $lat]
            )
            ->whereRaw(
                'ST_Distance_Sphere(POINT(technician_profiles.longitude, technician_profiles.latitude), POINT(?, ?)) <= ?',
                [$lng, $lat, $radiusMeters]
            );
    }

    private function applyAvailabilityFilter(Builder $query, string $availableOn, ?string $availableAt): void
    {
        $weekday = Carbon::createFromFormat('Y-m-d', $availableOn)->dayOfWeekIso;

        $query->whereHas('availabilitySlots', static function (Builder $slotQuery) use ($weekday, $availableAt): void {
            $slotQuery->where('weekday', $weekday);

            if ($availableAt !== null && $availableAt !== '') {
                $localTime = strlen($availableAt) === 5 ? $availableAt . ':00' : $availableAt;
                $slotQuery->where('start_time', '<=', $localTime)
                    ->where('end_time', '>', $localTime);
            }
        });
    }

    private function applySorting(Builder $query, string $sort, bool $hasCoordinates): void
    {
        match ($sort) {
            'distance' => $hasCoordinates
                ? $query->orderBy('distance_meters')->orderBy('technician_profiles.id')
                : $query->orderByDesc('technician_profiles.rating_avg')
                    ->orderByDesc('technician_profiles.rating_count')
                    ->orderBy('technician_profiles.id'),
            'experience' => $query->orderByDesc('technician_profiles.years_experience')
                ->orderBy('technician_profiles.id'),
            'recent' => $query->orderByDesc('technician_profiles.created_at')
                ->orderBy('technician_profiles.id'),
            default => $query->orderByDesc('technician_profiles.rating_avg')
                ->orderByDesc('technician_profiles.rating_count')
                ->orderBy('technician_profiles.id'),
        };
    }

    private function buildBooleanFullTextQuery(string $term): ?string
    {
        preg_match_all('/[\p{L}\p{N}]{3,}/u', $term, $matches);
        $tokens = $matches[0] ?? [];

        if ($tokens === []) {
            return null;
        }

        $booleanTokens = array_map(
            static fn (string $token): string => '+' . $token . '*',
            array_unique($tokens)
        );

        return implode(' ', $booleanTokens);
    }

    private function escapeLike(string $value): string
    {
        return addcslashes($value, '\\%_');
    }

    /**
     * Devuelve las columnas de un índice FULLTEXT existente que incluya $requiredColumn,
     * o null si la tabla no tiene un índice FULLTEXT aplicable en MySQL.
     *
     * @return array<int, string>|null
     */
    private function findFullTextColumns(string $table, string $requiredColumn): ?array
    {
        $indexes = $this->getTableFullTextIndexes($table);

        foreach ($indexes as $columns) {
            if ($columns === [$requiredColumn]) {
                return $columns;
            }
        }

        foreach ($indexes as $columns) {
            if (in_array($requiredColumn, $columns, true)) {
                return $columns;
            }
        }

        return null;
    }

    /**
     * @return array<int, array<int, string>>
     */
    private function getTableFullTextIndexes(string $table): array
    {
        $database = (string) DB::getDatabaseName();
        $cacheKey = $database . '.' . $table;

        if (array_key_exists($cacheKey, self::$fullTextIndexesCache)) {
            return self::$fullTextIndexesCache[$cacheKey];
        }

        $rows = DB::select(
            "SELECT INDEX_NAME, COLUMN_NAME
             FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = ?
               AND INDEX_TYPE = 'FULLTEXT'
             ORDER BY INDEX_NAME, SEQ_IN_INDEX",
            [$table]
        );

        $grouped = [];
        foreach ($rows as $row) {
            $grouped[$row->INDEX_NAME][] = $row->COLUMN_NAME;
        }

        return self::$fullTextIndexesCache[$cacheKey] = array_values($grouped);
    }
}