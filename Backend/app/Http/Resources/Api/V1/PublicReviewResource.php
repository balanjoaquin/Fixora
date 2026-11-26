<?php

declare(strict_types=1);

namespace App\Http\Resources\Api\V1;

use App\Services\ReviewService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Review
 */
class PublicReviewResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'rating' => (int) $this->rating,
            'comment' => $this->comment,
            'client_name' => ReviewService::formatClientShortName($this->client?->name),
            'specialty' => $this->serviceRequest?->specialty?->name,
            'technician_reply' => $this->technician_reply,
            'replied_at' => $this->replied_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}