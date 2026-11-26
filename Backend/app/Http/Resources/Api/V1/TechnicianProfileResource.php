<?php

declare(strict_types=1);

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\TechnicianProfile */
class TechnicianProfileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'headline' => $this->headline,
            'bio' => $this->bio,
            'years_experience' => $this->years_experience,
            'service_zone' => $this->service_zone,
            'latitude' => $this->latitude !== null ? (float) $this->latitude : null,
            'longitude' => $this->longitude !== null ? (float) $this->longitude : null,
            'service_radius_km' => $this->service_radius_km,
            'is_visible' => $this->is_visible,
            'rating_avg' => number_format((float) $this->rating_avg, 2, '.', ''),
            'rating_count' => $this->rating_count,
            'completed_count' => $this->completed_count,
            'specialties' => SpecialtyResource::collection($this->whenLoaded('specialties')),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}