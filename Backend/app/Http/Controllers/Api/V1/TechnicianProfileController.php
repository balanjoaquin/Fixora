<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Specialty;
use App\Models\TechnicianProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class TechnicianProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        $defaults = [
            'headline' => 'Técnico especialista',
            'bio' => '',
        ];

        if (Schema::hasColumn('technician_profiles', 'years_experience')) {
            $defaults['years_experience'] = 0;
        }
        if (Schema::hasColumn('technician_profiles', 'service_zone')) {
            $defaults['service_zone'] = '';
        }
        if (Schema::hasColumn('technician_profiles', 'is_visible')) {
            $defaults['is_visible'] = true;
        }

        $profile = TechnicianProfile::firstOrCreate(
            ['user_id' => $user->id],
            $defaults
        );

        $profile->load(['specialties', 'services']);

        return response()->json([
            'data' => $profile,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'headline' => ['nullable', 'string', 'max:180'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'experience_years' => ['nullable', 'integer', 'min:0', 'max:60'],
            'years_experience' => ['nullable', 'integer', 'min:0', 'max:60'],
            'service_area' => ['nullable', 'string', 'max:255'],
            'service_zone' => ['nullable', 'string', 'max:255'],
            'is_available' => ['nullable', 'boolean'],
            'is_visible' => ['nullable', 'boolean'],
            'specialties' => ['nullable', 'array'],
            'specialties.*' => ['string', 'max:120'],
            'specialty_names' => ['nullable', 'array'],
            'specialty_names.*' => ['string', 'max:120'],
            'specialty_ids' => ['nullable', 'array'],
            'specialty_ids.*' => ['integer', 'exists:specialties,id'],
        ]);

        $user = $request->user();

        $profile = TechnicianProfile::firstOrCreate(
            ['user_id' => $user->id],
            ['headline' => 'Técnico especialista', 'bio' => '']
        );

        if (array_key_exists('headline', $validated) && Schema::hasColumn('technician_profiles', 'headline')) {
            $profile->headline = $validated['headline'];
        }
        if (array_key_exists('bio', $validated) && Schema::hasColumn('technician_profiles', 'bio')) {
            $profile->bio = $validated['bio'];
        }
        if (array_key_exists('service_zone', $validated) || array_key_exists('service_area', $validated)) {
            $zone = $validated['service_zone'] ?? $validated['service_area'];
            if (Schema::hasColumn('technician_profiles', 'service_zone')) {
                $profile->service_zone = $zone;
            } elseif (Schema::hasColumn('technician_profiles', 'service_area')) {
                $profile->service_area = $zone;
            }
        }
        if (array_key_exists('years_experience', $validated) || array_key_exists('experience_years', $validated)) {
            $years = $validated['years_experience'] ?? $validated['experience_years'];
            if (Schema::hasColumn('technician_profiles', 'years_experience')) {
                $profile->years_experience = $years;
            } elseif (Schema::hasColumn('technician_profiles', 'experience_years')) {
                $profile->experience_years = $years;
            }
        }
        if (array_key_exists('is_available', $validated) && Schema::hasColumn('technician_profiles', 'is_available')) {
            $profile->is_available = (bool) $validated['is_available'];
        }
        if (Schema::hasColumn('technician_profiles', 'is_visible')) {
            if (array_key_exists('is_visible', $validated)) {
                $profile->is_visible = (bool) $validated['is_visible'];
            } elseif (array_key_exists('is_available', $validated)) {
                $profile->is_visible = (bool) $validated['is_available'];
            } else {
                $profile->is_visible = true;
            }
        }

        $profile->save();

        if (
            array_key_exists('specialties', $validated) ||
            array_key_exists('specialty_names', $validated) ||
            array_key_exists('specialty_ids', $validated)
        ) {
            $ids = $this->resolveSpecialtyIds($validated);
            $profile->specialties()->sync($ids);
        }

        $profile->load('specialties');

        return response()->json([
            'message' => 'Perfil técnico actualizado correctamente.',
            'data' => $profile,
        ]);
    }

    public function uploadAvatar(Request $request): JsonResponse
    {
        $request->validate(
            [
                'avatar' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png', 'max:2048'],
            ],
            [
                'avatar.required' => 'Selecciona una imagen para tu perfil.',
                'avatar.image' => 'El archivo seleccionado debe ser una imagen válida.',
                'avatar.mimes' => 'La foto debe estar en formato PNG o JPG.',
                'avatar.max' => 'La foto de perfil no debe superar los 2 MB.',
            ]
        );

        $user = $request->user();

        $profile = TechnicianProfile::firstOrCreate(
            ['user_id' => $user->id],
            ['headline' => 'Técnico especialista', 'bio' => '']
        );

        if ($profile->avatar_path && Storage::disk('public')->exists($profile->avatar_path)) {
            Storage::disk('public')->delete($profile->avatar_path);
        }

        $storedPath = $request->file('avatar')->store('avatars/technicians', 'public');

        if (Schema::hasColumn('technician_profiles', 'avatar_path')) {
            $profile->avatar_path = $storedPath;
            $profile->save();
        }

        return response()->json([
            'message' => 'Foto de perfil actualizada correctamente.',
            'avatar_url' => $profile->avatar_url,
            'data' => $profile,
        ]);
    }

    public function deleteAvatar(Request $request): JsonResponse
    {
        $user = $request->user();

        $profile = TechnicianProfile::where('user_id', $user->id)->first();

        if ($profile) {
            if ($profile->avatar_path && Storage::disk('public')->exists($profile->avatar_path)) {
                Storage::disk('public')->delete($profile->avatar_path);
            }

            if (Schema::hasColumn('technician_profiles', 'avatar_path')) {
                $profile->avatar_path = null;
                $profile->save();
            }
        }

        return response()->json([
            'message' => 'Foto de perfil eliminada.',
            'avatar_url' => null,
            'data' => $profile,
        ]);
    }

    public function syncSpecialties(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'specialty_ids' => ['nullable', 'array'],
            'specialty_ids.*' => ['integer', 'exists:specialties,id'],
            'specialties' => ['nullable', 'array'],
            'specialties.*' => ['string', 'max:120'],
            'specialty_names' => ['nullable', 'array'],
            'specialty_names.*' => ['string', 'max:120'],
        ]);

        $user = $request->user();

        $profile = TechnicianProfile::firstOrCreate(
            ['user_id' => $user->id],
            ['headline' => 'Técnico especialista', 'bio' => '']
        );

        $ids = $this->resolveSpecialtyIds($validated);
        $profile->specialties()->sync($ids);

        if (Schema::hasColumn('technician_profiles', 'is_visible') && count($ids) > 0) {
            $profile->is_visible = true;
            $profile->save();
        }

        $profile->load('specialties');

        return response()->json([
            'message' => 'Especialidades actualizadas correctamente.',
            'data' => $profile->specialties,
        ]);
    }

    /**
     * @param array<string, mixed> $validated
     * @return array<int, int>
     */
    private function resolveSpecialtyIds(array $validated): array
    {
        $ids = collect($validated['specialty_ids'] ?? [])
            ->map(fn ($id): int => (int) $id)
            ->all();

        $rawNames = array_merge(
            $validated['specialties'] ?? [],
            $validated['specialty_names'] ?? []
        );

        $hasSlug = Schema::hasColumn('specialties', 'slug');
        $hasIsActive = Schema::hasColumn('specialties', 'is_active');

        foreach ($rawNames as $rawName) {
            $cleanName = trim((string) $rawName);
            if ($cleanName === '') {
                continue;
            }

            $lookup = $hasSlug
                ? ['slug' => Str::slug($cleanName) !== '' ? Str::slug($cleanName) : Str::random(8)]
                : ['name' => $cleanName];

            $createValues = ['name' => $cleanName];
            if ($hasIsActive) {
                $createValues['is_active'] = true;
            }

            $specialty = Specialty::firstOrCreate($lookup, $createValues);
            $ids[] = (int) $specialty->id;
        }

        return array_values(array_unique($ids));
    }
}