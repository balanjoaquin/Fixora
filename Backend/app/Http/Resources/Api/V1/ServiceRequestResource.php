<?php

declare(strict_types=1);

namespace App\Http\Resources\Api\V1;

use App\Enums\ServiceRequestStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Services\ServiceRequestStateMachine;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\ServiceRequest
 */
class ServiceRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $viewer = $request->user();

        $revealSensitiveDetails = in_array($this->status, [
            ServiceRequestStatus::Accepted,
            ServiceRequestStatus::InProgress,
            ServiceRequestStatus::Completed,
        ], true);

        $availableActions = $viewer !== null
            ? app(ServiceRequestStateMachine::class)->availableActions($viewer, $this->resource)
            : [];

        $hasReview = $this->relationLoaded('review')
            ? $this->review !== null
            : $this->review()->exists();

        $canReview = $viewer !== null
            && $viewer->status === UserStatus::Active
            && $viewer->role === UserRole::Client
            && (int) $this->client_id === (int) $viewer->id
            && $this->status === ServiceRequestStatus::Completed
            && !$hasReview;

        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'title' => $this->title,
            'description' => $this->description,
            'approx_zone' => $this->approx_zone,
            'address_line' => $this->when($revealSensitiveDetails, $this->address_line),
            'latitude' => $this->when(
                $revealSensitiveDetails && $this->latitude !== null,
                fn (): float => (float) $this->latitude
            ),
            'longitude' => $this->when(
                $revealSensitiveDetails && $this->longitude !== null,
                fn (): float => (float) $this->longitude
            ),
            'preferred_date' => $this->preferred_date?->format('Y-m-d'),
            'preferred_start' => $this->preferred_start !== null
                ? substr((string) $this->preferred_start, 0, 5)
                : null,
            'expires_at' => $this->expires_at?->toIso8601String(),
            'accepted_at' => $this->accepted_at?->toIso8601String(),
            'started_at' => $this->started_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'closing_reason' => $this->closing_reason,
            'available_actions' => $availableActions,
            'can_review' => $canReview,
            'review' => $this->review !== null ? [
                'rating' => (int) $this->review->rating,
                'comment' => $this->review->comment,
                'created_at' => $this->review->created_at?->toIso8601String(),
                'technician_reply' => $this->review->technician_reply,
            ] : null,
            'specialty' => $this->whenLoaded('specialty', fn (): array => [
                'id' => $this->specialty->id,
                'name' => $this->specialty->name,
                'slug' => $this->specialty->slug,
            ]),
            'service' => $this->whenLoaded('technicianService', function (): ?array {
                if ($this->technicianService === null) {
                    return null;
                }

                return [
                    'id' => $this->technicianService->id,
                    'title' => $this->technicianService->title,
                    'reference_price' => $this->technicianService->reference_price !== null
                        ? number_format((float) $this->technicianService->reference_price, 2, '.', '')
                        : null,
                ];
            }),
            'client' => $this->whenLoaded('client', function () use ($revealSensitiveDetails): array {
                return [
                    'id' => $this->client->id,
                    'name' => $this->client->name,
                    'phone' => $this->when($revealSensitiveDetails, $this->client->phone),
                ];
            }),
            'technician' => $this->whenLoaded('technicianProfile', function () use ($revealSensitiveDetails): array {
                return [
                    'id' => $this->technicianProfile->id,
                    'name' => $this->technicianProfile->user?->name,
                    'headline' => $this->technicianProfile->headline,
                    'service_zone' => $this->technicianProfile->service_zone,
                    'years_experience' => (int) $this->technicianProfile->years_experience,
                    'rating_avg' => number_format((float) $this->technicianProfile->rating_avg, 2, '.', ''),
                    'rating_count' => (int) $this->technicianProfile->rating_count,
                    'completed_count' => (int) $this->technicianProfile->completed_count,
                    'verified' => $this->technicianProfile->verified_at !== null,
                    'phone' => $this->when($revealSensitiveDetails, $this->technicianProfile->user?->phone),
                ];
            }),
            'events' => RequestEventResource::collection($this->whenLoaded('events')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}