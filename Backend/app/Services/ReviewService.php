<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\ServiceRequestStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Exceptions\InvalidTransitionException;
use App\Models\Review;
use App\Models\ServiceRequest;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Notifications\ReviewReceivedNotification;
use App\Notifications\ReviewRepliedNotification;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReviewService
{
    /**
     * Crea una reseña verificada para una solicitud completada y recalcula el promedio del técnico
     * dentro de la misma transacción.
     */
    public function createForRequest(
        User $client,
        ServiceRequest $serviceRequest,
        int $rating,
        ?string $rawComment = null,
    ): Review {
        if ($client->role !== UserRole::Client || (int) $serviceRequest->client_id !== (int) $client->id) {
            throw (new ModelNotFoundException())->setModel(ServiceRequest::class, [$serviceRequest->id]);
        }

        if ($serviceRequest->status !== ServiceRequestStatus::Completed) {
            throw new InvalidTransitionException('Solo se puede calificar un servicio completado');
        }

        if (Review::query()->where('service_request_id', $serviceRequest->id)->exists()) {
            throw new InvalidTransitionException('Esta solicitud ya fue calificada.');
        }

        $cleanComment = $this->sanitizeText($rawComment);

        try {
            return DB::transaction(function () use ($client, $serviceRequest, $rating, $cleanComment): Review {
                /** @var TechnicianProfile $profile */
                $profile = TechnicianProfile::query()
                    ->with('user')
                    ->whereKey($serviceRequest->technician_profile_id)
                    ->lockForUpdate()
                    ->firstOrFail();

                if (Review::query()->where('service_request_id', $serviceRequest->id)->lockForUpdate()->exists()) {
                    throw new InvalidTransitionException('Esta solicitud ya fue calificada.');
                }

                /** @var Review $review */
                $review = Review::query()->create([
                    'service_request_id' => $serviceRequest->id,
                    'client_id' => $client->id,
                    'technician_profile_id' => $profile->id,
                    'rating' => $rating,
                    'comment' => $cleanComment,
                    'is_hidden' => false,
                ]);

                $this->recalculateForTechnician($profile);

                $fresh = $review->fresh([
                    'client:id,name',
                    'serviceRequest:id,specialty_id',
                    'serviceRequest.specialty:id,name,slug',
                ]);

                $technicianUser = $profile->user;
                if ($technicianUser !== null && $technicianUser->status !== UserStatus::Suspended) {
                    $technicianUser->notify(new ReviewReceivedNotification($fresh));
                }

                return $fresh;
            });
        } catch (UniqueConstraintViolationException $e) {
            throw new InvalidTransitionException('Esta solicitud ya fue calificada.', 409, $e);
        } catch (QueryException $e) {
            if ($this->isUniqueConstraintViolation($e)) {
                throw new InvalidTransitionException('Esta solicitud ya fue calificada.', 409, $e);
            }

            throw $e;
        }
    }

    /**
     * Registra la respuesta pública única del técnico dueño de la reseña.
     */
    public function replyToReview(User $technician, Review $review, string $rawBody): Review
    {
        $profileId = $technician->technicianProfile?->id;

        if (
            $technician->role !== UserRole::Technician
            || $profileId === null
            || (int) $review->technician_profile_id !== (int) $profileId
            || (bool) $review->is_hidden
        ) {
            throw (new ModelNotFoundException())->setModel(Review::class, [$review->id]);
        }

        $cleanBody = $this->sanitizeText($rawBody);
        if ($cleanBody === null) {
            throw ValidationException::withMessages([
                'body' => ['El texto de la respuesta es obligatorio.'],
            ]);
        }

        return DB::transaction(function () use ($review, $profileId, $cleanBody): Review {
            /** @var Review $locked */
            $locked = Review::query()
                ->whereKey($review->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ((int) $locked->technician_profile_id !== (int) $profileId || (bool) $locked->is_hidden) {
                throw (new ModelNotFoundException())->setModel(Review::class, [$review->id]);
            }

            if ($locked->technician_reply !== null) {
                throw new InvalidTransitionException('Esta reseña ya cuenta con una respuesta.');
            }

            $locked->forceFill([
                'technician_reply' => $cleanBody,
                'replied_at' => Carbon::now('UTC'),
            ])->save();

            $fresh = $locked->fresh([
                'client:id,name,email,email_verified_at,status',
                'serviceRequest:id,specialty_id',
                'serviceRequest.specialty:id,name,slug',
            ]);

            $clientUser = $fresh->client;
            if ($clientUser !== null && $clientUser->status !== UserStatus::Suspended) {
                $clientUser->notify(new ReviewRepliedNotification($fresh));
            }

            return $fresh;
        });
    }

    /**
     * Consulta pública paginada de reseñas visibles de un técnico activo y visible,
     * más el resumen global y distribución de calificaciones.
     *
     * @param array{rating?: int|string|null, sort?: string|null, per_page?: int|string|null} $filters
     * @return array{
     *     paginator: LengthAwarePaginator,
     *     summary: array{rating_avg: string, rating_count: int, distribution: array<int, int>}
     * }
     */
    public function listPublicForTechnician(int $technicianProfileId, array $filters = []): array
    {
        /** @var TechnicianProfile|null $profile */
        $profile = TechnicianProfile::query()
            ->whereKey($technicianProfileId)
            ->where('is_visible', true)
            ->whereHas('user', static function ($query): void {
                $query->where('status', UserStatus::Active->value)
                    ->where('role', UserRole::Technician->value);
            })
            ->first();

        if ($profile === null) {
            throw (new ModelNotFoundException())->setModel(TechnicianProfile::class, [$technicianProfileId]);
        }

        $query = Review::query()
            ->where('technician_profile_id', $profile->id)
            ->where('is_hidden', false)
            ->with([
                'client:id,name',
                'serviceRequest:id,specialty_id',
                'serviceRequest.specialty:id,name',
            ]);

        if (!empty($filters['rating'])) {
            $query->where('rating', (int) $filters['rating']);
        }

        $sort = (string) ($filters['sort'] ?? 'recent');
        match ($sort) {
            'highest' => $query->orderByDesc('rating')->orderByDesc('id'),
            'lowest' => $query->orderBy('rating')->orderByDesc('id'),
            default => $query->orderByDesc('created_at')->orderByDesc('id'),
        };

        $perPage = min(max((int) ($filters['per_page'] ?? 10), 1), 24);
        $paginator = $query->paginate($perPage);

        return [
            'paginator' => $paginator,
            'summary' => $this->buildPublicSummary($profile->id),
        ];
    }

    /**
     * Lista paginada de todas las reseñas recibidas por el técnico autenticado
     * (incluidas las ocultas con su bandera is_hidden).
     *
     * @param array{pending_reply?: mixed, per_page?: int|string|null} $filters
     */
    public function listForTechnician(User $technician, array $filters = []): LengthAwarePaginator
    {
        $profileId = $technician->technicianProfile?->id ?? 0;

        $query = Review::query()
            ->where('technician_profile_id', $profileId)
            ->with([
                'client:id,name',
                'serviceRequest:id,specialty_id',
                'serviceRequest.specialty:id,name',
            ]);

        if (array_key_exists('pending_reply', $filters) && $filters['pending_reply'] !== null && $filters['pending_reply'] !== '') {
            $pendingReply = filter_var($filters['pending_reply'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($pendingReply === true) {
                $query->whereNull('technician_reply');
            } elseif ($pendingReply === false) {
                $query->whereNotNull('technician_reply');
            }
        }

        $perPage = min(max((int) ($filters['per_page'] ?? 12), 1), 24);

        return $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);
    }

    /**
     * Método único centralizado para recalcular rating_avg y rating_count de un técnico
     * considerando únicamente reseñas con is_hidden = 0.
     *
     * @return array{rating_avg: string, rating_count: int}
     */
    public function recalculateForTechnician(TechnicianProfile $profile): array
    {
        $metrics = $this->computeExpectedMetrics($profile->id);

        $profile->forceFill([
            'rating_avg' => $metrics['rating_avg'],
            'rating_count' => $metrics['rating_count'],
        ])->save();

        return [
            'rating_avg' => $metrics['rating_avg'],
            'rating_count' => $metrics['rating_count'],
        ];
    }

    /**
     * Calcula rating_avg, rating_count (is_hidden = 0) y completed_count (status = completed)
     * sin escribir en la base de datos.
     *
     * @return array{rating_avg: string, rating_count: int, completed_count: int}
     */
    public function computeExpectedMetrics(int $technicianProfileId): array
    {
        $stats = Review::query()
            ->where('technician_profile_id', $technicianProfileId)
            ->where('is_hidden', false)
            ->selectRaw('COUNT(*) as aggregate_count, COALESCE(ROUND(AVG(rating), 2), 0) as aggregate_avg')
            ->first();

        $ratingCount = (int) ($stats?->aggregate_count ?? 0);
        $ratingAvg = $ratingCount > 0
            ? number_format(round((float) $stats->aggregate_avg, 2), 2, '.', '')
            : '0.00';

        $completedCount = ServiceRequest::query()
            ->where('technician_profile_id', $technicianProfileId)
            ->where('status', ServiceRequestStatus::Completed->value)
            ->count();

        return [
            'rating_avg' => $ratingAvg,
            'rating_count' => $ratingCount,
            'completed_count' => $completedCount,
        ];
    }

    /**
     * Construye el resumen público y la distribución de calificaciones visibles (1..5).
     *
     * @return array{rating_avg: string, rating_count: int, distribution: array<int, int>}
     */
    public function buildPublicSummary(int $technicianProfileId): array
    {
        $rows = Review::query()
            ->where('technician_profile_id', $technicianProfileId)
            ->where('is_hidden', false)
            ->selectRaw('rating, COUNT(*) as total')
            ->groupBy('rating')
            ->get();

        $distribution = [
            1 => 0,
            2 => 0,
            3 => 0,
            4 => 0,
            5 => 0,
        ];

        $totalCount = 0;
        $weightedSum = 0;

        foreach ($rows as $row) {
            $stars = (int) $row->rating;
            $count = (int) $row->total;
            if (array_key_exists($stars, $distribution)) {
                $distribution[$stars] = $count;
                $totalCount += $count;
                $weightedSum += $stars * $count;
            }
        }

        $ratingAvg = $totalCount > 0
            ? number_format(round($weightedSum / $totalCount, 2), 2, '.', '')
            : '0.00';

        return [
            'rating_avg' => $ratingAvg,
            'rating_count' => $totalCount,
            'distribution' => $distribution,
        ];
    }

    /**
     * Limpia texto de reseña o respuesta: elimina etiquetas HTML, normaliza saltos de línea
     * repetidos y recorta espacios. Devuelve null si queda vacío.
     */
    public function sanitizeText(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $stripped = strip_tags($value);
        $normalizedNewlines = preg_replace("/\r\n|\r/", "\n", $stripped) ?? $stripped;
        $collapsedNewlines = preg_replace("/\n{2,}/", "\n", $normalizedNewlines) ?? $normalizedNewlines;
        $trimmed = trim($collapsedNewlines);

        return $trimmed === '' ? null : $trimmed;
    }

    /**
     * Abrevia el nombre del cliente a primer nombre + inicial del segundo token (ej. "Ana P.").
     * Si solo existe una palabra, la devuelve tal cual.
     */
    public static function formatClientShortName(?string $fullName): string
    {
        if ($fullName === null) {
            return '';
        }

        $parts = preg_split('/\s+/u', trim($fullName), -1, PREG_SPLIT_NO_EMPTY);
        if ($parts === false || $parts === []) {
            return '';
        }

        if (count($parts) === 1) {
            return $parts[0];
        }

        $initial = mb_strtoupper(mb_substr($parts[1], 0, 1, 'UTF-8'), 'UTF-8');

        return "{$parts[0]} {$initial}.";
    }

    private function isUniqueConstraintViolation(QueryException $e): bool
    {
        $sqlState = (string) ($e->errorInfo[0] ?? $e->getCode());
        $driverCode = (int) ($e->errorInfo[1] ?? 0);

        return $sqlState === '23000'
            || $sqlState === '23505'
            || $driverCode === 1062
            || $driverCode === 19
            || $driverCode === 2067;
    }
}