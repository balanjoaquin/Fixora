<?php

declare(strict_types=1);

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\TechnicianService */
class TechnicianPublicServiceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'specialty_id' => $this->specialty_id,
            'reference_price' => $this->reference_price !== null
                ? number_format((float) $this->reference_price, 2, '.', '')
                : null,
        ];
    }
}