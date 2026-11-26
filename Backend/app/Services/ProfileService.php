<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\UserRole;
use App\Models\Specialty;
use App\Models\TechnicianProfile;
use App\Models\TechnicianService;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class ProfileService
{
    public function __construct(
        private readonly AuthService $authService,
        private readonly ProfileVisibilityService $visibilityService,
    ) {
    }

    /**
     * @param array{name: string, phone: string} $data
     */
    public function updateAccount(User $user, array $data): User
    {
        return DB::transaction(function () use ($user, $data): User {
            $user->update([
                'name' => trim($data['name']),
                'phone' => $this->authService->normalizePhone($data['phone']),
            ]);

            if ($user->role === UserRole::Technician && $user->technicianProfile !== null) {
                $this->visibilityService->recalculate($user->technicianProfile);
            }

            return $user->fresh(['technicianProfile']);
        });
    }

    public function updatePassword(User $user, string $currentPassword, string $newPassword): void
    {
        if (!Hash::check($currentPassword, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['La contraseña actual es incorrecta.'],
            ]);
        }

        DB::transaction(function () use ($user, $newPassword): void {
            $user->update([
                'password' => $newPassword,
            ]);

            $currentTokenId = $user->currentAccessToken()?->id;

            if ($currentTokenId !== null) {
                $user->tokens()->where('id', '!=', $currentTokenId)->delete();
            } else {
                $user->tokens()->delete();
            }
        });
    }

    public function getOrCreateTechnicianProfile(User $user): TechnicianProfile
    {
        $profile = TechnicianProfile::query()->firstOrCreate(
            ['user_id' => $user->id],
            [
                'years_experience' => 0,
                'is_visible' => false,
                'rating_avg' => 0,
                'rating_count' => 0,
                'completed_count' => 0,
            ]
        );

        return $profile->load('specialties');
    }

    /**
     * @param array{
     *     headline?: string|null,
     *     bio?: string|null,
     *     years_experience?: int,
     *     service_zone?: string|null,
     *     latitude?: string|float|null,
     *     longitude?: string|float|null,
     *     service_radius_km?: int|null
     * } $data
     */
    public function updateTechnicianProfile(TechnicianProfile $profile, array $data): TechnicianProfile
    {
        return DB::transaction(function () use ($profile, $data): TechnicianProfile {
            $profile->fill([
                'headline' => $data['headline'] ?? null,
                'bio' => $data['bio'] ?? null,
                'years_experience' => $data['years_experience'] ?? $profile->years_experience,
                'service_zone' => $data['service_zone'] ?? null,
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
                'service_radius_km' => $data['service_radius_km'] ?? null,
            ]);
            $profile->save();

            $recalculated = $this->visibilityService->recalculate($profile);

            return $recalculated->load('specialties');
        });
    }

    /**
     * @param array<int, int> $specialtyIds
     */
    public function syncTechnicianSpecialties(TechnicianProfile $profile, array $specialtyIds): TechnicianProfile
    {
        return DB::transaction(function () use ($profile, $specialtyIds): TechnicianProfile {
            $profile->specialties()->sync($specialtyIds);

            $recalculated = $this->visibilityService->recalculate($profile);

            return $recalculated->load('specialties');
        });
    }

    /**
     * @return Collection<int, Specialty>
     */
    public function listActiveSpecialties(): Collection
    {
        return Specialty::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->get();
    }

    /**
     * @return Collection<int, TechnicianService>
     */
    public function listTechnicianServices(TechnicianProfile $profile): Collection
    {
        return TechnicianService::query()
            ->with('specialty')
            ->where('technician_profile_id', $profile->id)
            ->where('is_active', true)
            ->orderByDesc('id')
            ->get();
    }

    /**
     * @param array{
     *     specialty_id: int,
     *     title: string,
     *     description?: string|null,
     *     reference_price?: string|float|null
     * } $data
     */
    public function createTechnicianService(TechnicianProfile $profile, array $data): TechnicianService
    {
        $this->ensureSpecialtyBelongsToTechnician($profile, (int) $data['specialty_id']);

        $service = TechnicianService::query()->create([
            'technician_profile_id' => $profile->id,
            'specialty_id' => (int) $data['specialty_id'],
            'title' => trim($data['title']),
            'description' => isset($data['description']) ? trim((string) $data['description']) : null,
            'reference_price' => $data['reference_price'] ?? null,
            'is_active' => true,
        ]);

        return $service->load('specialty');
    }

    /**
     * @param array{
     *     specialty_id?: int,
     *     title?: string,
     *     description?: string|null,
     *     reference_price?: string|float|null
     * } $data
     */
    public function updateTechnicianService(TechnicianService $service, array $data): TechnicianService
    {
        if (array_key_exists('specialty_id', $data)) {
            $this->ensureSpecialtyBelongsToTechnician($service->technicianProfile, (int) $data['specialty_id']);
            $service->specialty_id = (int) $data['specialty_id'];
        }

        if (array_key_exists('title', $data)) {
            $service->title = trim((string) $data['title']);
        }

        if (array_key_exists('description', $data)) {
            $service->description = $data['description'] !== null ? trim((string) $data['description']) : null;
        }

        if (array_key_exists('reference_price', $data)) {
            $service->reference_price = $data['reference_price'];
        }

        $service->save();

        return $service->fresh(['specialty']);
    }

    public function deactivateTechnicianService(TechnicianService $service): void
    {
        $service->update([
            'is_active' => false,
        ]);
    }

    private function ensureSpecialtyBelongsToTechnician(TechnicianProfile $profile, int $specialtyId): void
    {
        $assigned = $profile->specialties()
            ->where('specialties.id', $specialtyId)
            ->where('specialties.is_active', true)
            ->exists();

        if (!$assigned) {
            throw ValidationException::withMessages([
                'specialty_id' => ['La especialidad seleccionada no está asignada a tu perfil profesional.'],
            ]);
        }
    }
}