<?php

declare(strict_types=1);

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\TechnicianProfile */
class TechnicianPublicSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $hasProximitySearch = $this->resource->getAttribute('distance_meters') !== null;
        $distanceKm = $hasProximitySearch
            ? round(((float) $this->resource->getAttribute('distance_meters')) / 1000.0, 1)
            : null;

        return [
            'id' => $this->id,
            'name' => $this->user?->name,
            'headline' => $this->headline,
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
            'rating_avg' => number_format((float) $this->rating_avg, 2, '.', ''),
            'rating_count' => (int) $this->rating_count,
            'completed_count' => (int) $this->completed_count,
            'verified' => $this->verified_at !== null,
            $this->mergeWhen($hasProximitySearch, [
                'distance_km' => $distanceKm,
                'within_service_radius' => $this->service_radius_km !== null
                    && $distanceKm !== null
                    && $distanceKm <= (float) $this->service_radius_km,
            ]),
        ];
    }
}