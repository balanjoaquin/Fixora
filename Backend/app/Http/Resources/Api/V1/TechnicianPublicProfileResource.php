<?php

declare(strict_types=1);

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Recurso público de perfil técnico (RN-09 / RNF-03).
 * Nunca expone email, teléfono, user_id, coordenadas exactas ni tokens.
 *
 * @mixin \App\Models\TechnicianProfile
 */
class TechnicianPublicProfileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->user?->name,
            'headline' => $this->headline,
            'bio' => $this->bio,
            'years_experience' => (int) $this->years_experience,
            'service_zone' => $this->service_zone,
            'specialties' => $this->whenLoaded('specialties', fn () => $this->specialties->map(
                static fn ($specialty): array => [
                    'id' => $specialty->id,
                    'name' => $specialty->name,
                    'slug' => $specialty->slug,
                    'icon' => $specialty->icon,
                ]
            )->values()),
            'services' => TechnicianPublicServiceResource::collection($this->whenLoaded('services')),
            'availability' => AvailabilitySlotResource::collection($this->whenLoaded('availabilitySlots')),
            'rating_avg' => number_format((float) $this->rating_avg, 2, '.', ''),
            'rating_count' => (int) $this->rating_count,
            'completed_count' => (int) $this->completed_count,
            'verified' => $this->verified_at !== null,
            // Ubicación aproximada (~1 km) redondeada a 2 decimales (RN-09)
            'latitude' => $this->latitude !== null ? round((float) $this->latitude, 2) : null,
            'longitude' => $this->longitude !== null ? round((float) $this->longitude, 2) : null,
        ];
    }
}