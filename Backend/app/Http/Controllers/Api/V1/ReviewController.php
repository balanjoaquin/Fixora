<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Review;
use App\Models\ServiceRequest;
use App\Models\TechnicianProfile;
use BackedEnum;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;

class ReviewController extends Controller
{
    /**
     * Reseñas públicas de un técnico (GET /api/v1/technicians/{id}/reviews).
     */
    public function publicIndex(int|string $id): JsonResponse
    {
        $numericId = (int) $id;
        $profile = TechnicianProfile::where('id', $numericId)
            ->orWhere('user_id', $numericId)
            ->first();

        if (! $profile) {
            return response()->json(['data' => []]);
        }

        $query = Review::query()
            ->with(['client', 'serviceRequest.specialty'])
            ->where('technician_profile_id', $profile->id)
            ->latest();

        if (Schema::hasColumn('reviews', 'is_hidden')) {
            $query->where('is_hidden', false);
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    /**
     * Cliente califica un servicio finalizado (POST /api/v1/requests/{serviceRequest}/review).
     */
    public function store(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        $user = $request->user();

        if ((int) $serviceRequest->client_id !== (int) $user->id) {
            return response()->json(['message' => 'No autorizado para calificar esta solicitud.'], 403);
        }

        $statusValue = $serviceRequest->status instanceof BackedEnum
            ? (string) $serviceRequest->status->value
            : (string) $serviceRequest->status;

        if ($statusValue !== 'completed') {
            return response()->json(['message' => 'Solo puedes calificar servicios finalizados.'], 422);
        }

        $validated = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:2000'],
            'photos' => ['nullable', 'array', 'max:3'],
            'photos.*' => ['file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $existing = Review::where('service_request_id', $serviceRequest->id)->first();
        if ($existing) {
            return response()->json(['message' => 'Ya calificaste este servicio anteriormente.'], 422);
        }

        $photoUrls = [];
        $uploadedPhotos = $request->file('photos');
        if (is_array($uploadedPhotos)) {
            foreach ($uploadedPhotos as $file) {
                if ($file instanceof UploadedFile) {
                    $path = $file->store('fixora/reviews', 'public');
                    $photoUrls[] = url('storage/' . $path);
                }
            }
        }

        $profileId = $serviceRequest->technician_profile_id;

        $review = Review::create([
            'service_request_id' => $serviceRequest->id,
            'client_id' => $user->id,
            'technician_profile_id' => $profileId,
            'rating' => (int) $validated['rating'],
            'comment' => trim((string) ($validated['comment'] ?? '')),
            'photos' => $photoUrls !== [] ? $photoUrls : null,
        ]);

        if ($profileId) {
            $this->recalculateTechnicianRating((int) $profileId);
        }

        return response()->json([
            'message' => '¡Gracias por tu calificación!',
            'data' => $review->load(['client']),
        ], 201);
    }

    /**
     * Reseñas recibidas por el técnico autenticado (GET /api/v1/technician/reviews).
     */
    public function technicianIndex(Request $request): JsonResponse
    {
        $profile = $request->user()->technicianProfile;
        if (! $profile) {
            return response()->json(['data' => []]);
        }

        $query = Review::query()
            ->with(['client', 'serviceRequest.specialty'])
            ->where('technician_profile_id', $profile->id)
            ->latest();

        if (Schema::hasColumn('reviews', 'is_hidden')) {
            $query->where('is_hidden', false);
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    /**
     * Técnico responde a una reseña recibida (POST /api/v1/reviews/{review}/reply).
     */
    public function reply(Request $request, Review $review): JsonResponse
    {
        $profile = $request->user()->technicianProfile;

        if (! $profile || (int) $review->technician_profile_id !== (int) $profile->id) {
            return response()->json(['message' => 'No autorizado para responder esta reseña.'], 403);
        }

        $validated = $request->validate([
            'reply' => ['nullable', 'string', 'max:1500'],
            'technician_reply' => ['nullable', 'string', 'max:1500'],
        ]);

        $replyText = trim((string) ($validated['reply'] ?? $validated['technician_reply'] ?? ''));
        if ($replyText === '') {
            return response()->json(['message' => 'Escribe una respuesta antes de enviar.'], 422);
        }

        $review->update([
            'technician_reply' => $replyText,
            'replied_at' => now(),
        ]);

        return response()->json([
            'message' => 'Respuesta publicada correctamente.',
            'data' => $review->fresh(['client', 'serviceRequest.specialty']),
        ]);
    }

    private function recalculateTechnicianRating(int $profileId): void
    {
        $profile = TechnicianProfile::find($profileId);
        if (! $profile) {
            return;
        }

        $query = Review::where('technician_profile_id', $profileId);
        if (Schema::hasColumn('reviews', 'is_hidden')) {
            $query->where('is_hidden', false);
        }

        $count = (int) $query->count();
        $avg = $count > 0 ? round((float) $query->avg('rating'), 2) : 0.0;

        if (Schema::hasColumn('technician_profiles', 'rating_avg')) {
            $profile->rating_avg = $avg;
        }
        if (Schema::hasColumn('technician_profiles', 'rating_count')) {
            $profile->rating_count = $count;
        }
        $profile->save();
    }
}