<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Specialty;
use App\Models\TechnicianService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class TechnicianServiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $profile = $request->user()->technicianProfile;
        if (! $profile) {
            return response()->json(['data' => []]);
        }

        $services = TechnicianService::query()
            ->with(['specialty'])
            ->where('technician_profile_id', $profile->id)
            ->latest()
            ->get();

        return response()->json([
            'data' => $services,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $profile = $request->user()->technicianProfile;
        if (! $profile) {
            return response()->json(['message' => 'Completa primero tu perfil técnico.'], 422);
        }

        $validated = $request->validate([
            'specialty_id' => ['nullable', 'integer', 'exists:specialties,id'],
            'specialty_name' => ['nullable', 'string', 'max:120'],
            'title' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:2000'],
            'reference_price' => ['nullable', 'numeric', 'min:0', 'max:999999.99'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $specialtyId = $this->resolveSpecialtyId(
            $validated['specialty_id'] ?? null,
            $validated['specialty_name'] ?? null,
            $profile->specialties()->first()?->id
        );

        $service = TechnicianService::create([
            'technician_profile_id' => $profile->id,
            'specialty_id' => $specialtyId,
            'title' => trim((string) $validated['title']),
            'description' => trim((string) ($validated['description'] ?? '')) ?: null,
            'reference_price' => isset($validated['reference_price']) && $validated['reference_price'] !== ''
                ? (float) $validated['reference_price']
                : null,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json([
            'message' => 'Servicio agregado a tu catálogo.',
            'data' => $service->load(['specialty']),
        ], 201);
    }

    public function update(Request $request, TechnicianService $service): JsonResponse
    {
        $profile = $request->user()->technicianProfile;
        if (! $profile || (int) $service->technician_profile_id !== (int) $profile->id) {
            return response()->json(['message' => 'No autorizado para editar este servicio.'], 403);
        }

        $validated = $request->validate([
            'specialty_id' => ['nullable', 'integer', 'exists:specialties,id'],
            'specialty_name' => ['nullable', 'string', 'max:120'],
            'title' => ['sometimes', 'required', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:2000'],
            'reference_price' => ['nullable', 'numeric', 'min:0', 'max:999999.99'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $updates = [];

        if (array_key_exists('specialty_id', $validated) || array_key_exists('specialty_name', $validated)) {
            $updates['specialty_id'] = $this->resolveSpecialtyId(
                $validated['specialty_id'] ?? null,
                $validated['specialty_name'] ?? null,
                $service->specialty_id
            );
        }

        if (isset($validated['title'])) {
            $updates['title'] = trim((string) $validated['title']);
        }

        if (array_key_exists('description', $validated)) {
            $updates['description'] = trim((string) ($validated['description'] ?? '')) ?: null;
        }

        if (array_key_exists('reference_price', $validated)) {
            $updates['reference_price'] = $validated['reference_price'] !== null && $validated['reference_price'] !== ''
                ? (float) $validated['reference_price']
                : null;
        }

        if (array_key_exists('is_active', $validated)) {
            $updates['is_active'] = (bool) $validated['is_active'];
        }

        $service->update($updates);

        return response()->json([
            'message' => 'Servicio actualizado correctamente.',
            'data' => $service->fresh(['specialty']),
        ]);
    }

    public function destroy(Request $request, TechnicianService $service): JsonResponse
    {
        $profile = $request->user()->technicianProfile;
        if (! $profile || (int) $service->technician_profile_id !== (int) $profile->id) {
            return response()->json(['message' => 'No autorizado para eliminar este servicio.'], 403);
        }

        $service->delete();

        return response()->json([
            'message' => 'Servicio eliminado del catálogo.',
        ]);
    }

    private function resolveSpecialtyId(?int $specialtyId, ?string $specialtyName, ?int $fallbackId): ?int
    {
        if ($specialtyId) {
            return $specialtyId;
        }

        if ($specialtyName && trim($specialtyName) !== '') {
            $cleanName = trim($specialtyName);
            $slug = Str::slug($cleanName);

            $data = ['name' => $cleanName];
            if (Schema::hasColumn('specialties', 'is_active')) {
                $data['is_active'] = true;
            }

            $specialty = Specialty::firstOrCreate(
                ['slug' => $slug !== '' ? $slug : Str::random(8)],
                $data
            );

            return (int) $specialty->id;
        }

        if ($fallbackId) {
            return $fallbackId;
        }

        $defaultSpecialty = Specialty::first();
        return $defaultSpecialty ? (int) $defaultSpecialty->id : null;
    }
}