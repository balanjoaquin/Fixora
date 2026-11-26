<?php

declare(strict_types=1);

namespace App\Http\Resources\Api\V1;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\RequestEvent
 */
class RequestEventResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'from_status' => $this->from_status instanceof BackedEnum ? $this->from_status->value : $this->from_status,
            'to_status' => $this->to_status instanceof BackedEnum ? $this->to_status->value : $this->to_status,
            'actor_role' => $this->actor_role instanceof BackedEnum ? $this->actor_role->value : $this->actor_role,
            'reason' => $this->reason,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}