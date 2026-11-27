<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\TechnicianProfile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicTechnicianController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'specialty_id' => ['nullable', 'integer'],
            'specialty' => ['nullable', 'string', 'max:120'],
            'zone' => ['nullable', 'string', 'max:120'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $perPage = min((int) ($validated['per_page'] ?? 24), 24);

        $query = User::query()
            ->where('role', 'technician')
            ->where('status', 'active')
            ->whereHas('technicianProfile')
            ->with(['technicianProfile.specialties', 'technicianProfile.services']);

        if (! empty($validated['q'])) {
            $term = trim((string) $validated['q']);
            $query->where(function ($sub) use ($term): void {
                $sub->where('name', 'like', "%{$term}%")
                    ->orWhereHas('technicianProfile', function ($prof) use ($term): void {
                        $prof->where('bio', 'like', "%{$term}%")
                            ->orWhere('headline', 'like', "%{$term}%")
                            ->orWhere('service_zone', 'like', "%{$term}%")
                            ->orWhereHas('specialties', function ($spec) use ($term): void {
                                $spec->where('name', 'like', "%{$term}%");
                            });
                    });
            });
        }

        if (! empty($validated['specialty_id'])) {
            $specId = (int) $validated['specialty_id'];
            $query->whereHas('technicianProfile.specialties', function ($spec) use ($specId): void {
                $spec->where('specialties.id', $specId);
            });
        }

        if (! empty($validated['specialty'])) {
            $specName = trim((string) $validated['specialty']);
            $query->whereHas('technicianProfile.specialties', function ($spec) use ($specName): void {
                $spec->where('specialties.name', 'like', "%{$specName}%");
            });
        }

        if (! empty($validated['zone'])) {
            $zone = trim((string) $validated['zone']);
            $query->whereHas('technicianProfile', function ($prof) use ($zone): void {
                $prof->where('service_zone', 'like', "%{$zone}%");
            });
        }

        $paginated = $query->latest()->paginate($perPage);

        $items = collect($paginated->items())->map(function (User $tech): array {
            $profile = $tech->technicianProfile;

            return [
                'id' => $profile?->id ?? $tech->id,
                'user_id' => $tech->id,
                'name' => $tech->name,
                'email' => $tech->email,
                'phone' => $tech->phone,
                'headline' => $profile?->headline ?? '',
                'bio' => $profile?->bio ?? '',
                'avatar_url' => $profile?->avatar_url,
                'service_zone' => $profile?->service_zone ?? '',
                'service_area' => $profile?->service_zone ?? '',
                'years_experience' => $profile?->years_experience ?? 0,
                'experience_years' => $profile?->years_experience ?? 0,
                'is_available' => $profile?->is_visible ?? true,
                'rating_avg' => $profile?->rating_avg ?? 0,
                'rating_count' => $profile?->rating_count ?? 0,
                'completed_count' => $profile?->completed_count ?? 0,
                'specialties' => $profile?->specialties ?? [],
                'services' => $profile?->services ?? [],
            ];
        });

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        // 1. Buscar prioritariamente por technician_profiles.id
        $profile = TechnicianProfile::query()
            ->where('id', $id)
            ->whereHas('user', function ($q): void {
                $q->where('role', 'technician')
                    ->where('status', 'active');
            })
            ->with([
                'user',
                'specialties',
                'services',
                'availabilitySlots',
            ])
            ->first();

        // 2. Respaldo por users.id solo si no coincidió ningún profile.id
        if (! $profile) {
            $profile = TechnicianProfile::query()
                ->where('user_id', $id)
                ->whereHas('user', function ($q): void {
                    $q->where('role', 'technician')
                        ->where('status', 'active');
                })
                ->with([
                    'user',
                    'specialties',
                    'services',
                    'availabilitySlots',
                ])
                ->firstOrFail();
        }

        $tech = $profile->user;

        return response()->json([
            'data' => [
                'id' => $profile->id,
                'user_id' => $tech->id,
                'name' => $tech->name,
                'email' => $tech->email,
                'phone' => $tech->phone,
                'headline' => $profile->headline ?? '',
                'bio' => $profile->bio ?? '',
                'avatar_url' => $profile->avatar_url,
                'service_zone' => $profile->service_zone ?? '',
                'service_area' => $profile->service_zone ?? '',
                'years_experience' => $profile->years_experience ?? 0,
                'experience_years' => $profile->years_experience ?? 0,
                'is_available' => $profile->is_visible ?? true,
                'rating_avg' => $profile->rating_avg ?? 0,
                'rating_count' => $profile->rating_count ?? 0,
                'completed_count' => $profile->completed_count ?? 0,
                'specialties' => $profile->specialties ?? [],
                'services' => $profile->services ?? [],
                'availabilities' => $profile->availabilitySlots ?? [],
            ],
        ]);
    }
}