<?php

declare(strict_types=1);

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\TechnicianService */
class TechnicianServiceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'specialty_id' => $this->specialty_id,
            'specialty' => $this->whenLoaded('specialty', fn () => new SpecialtyResource($this->specialty)),
            'title' => $this->title,
            'description' => $this->description,
            'reference_price' => $this->reference_price !== null ? number_format((float) $this->reference_price, 2, '.', '') : null,
            'is_active' => $this->is_active,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}