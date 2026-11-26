<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\ActorRole;
use App\Enums\ServiceRequestStatus;
use App\Models\RequestEvent;
use App\Models\ServiceRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RequestEvent>
 */
class RequestEventFactory extends Factory
{
    protected $model = RequestEvent::class;

    public function definition(): array
    {
        return [
            'service_request_id' => ServiceRequest::factory(),
            'from_status' => null,
            'to_status' => ServiceRequestStatus::Pending,
            'actor_id' => null,
            'actor_role' => ActorRole::Client,
            'reason' => null,
            'created_at' => now()->utc(),
        ];
    }
}