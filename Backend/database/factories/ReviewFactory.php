<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Review;
use App\Models\ServiceRequest;
use App\Models\TechnicianProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Review>
 */
class ReviewFactory extends Factory
{
    protected $model = Review::class;

    public function definition(): array
    {
        return [
            'service_request_id' => ServiceRequest::factory(),
            'client_id' => User::factory(),
            'technician_profile_id' => TechnicianProfile::factory(),
            'rating' => 5,
            'comment' => 'Trabajo puntual y bien ejecutado.',
            'technician_reply' => null,
            'replied_at' => null,
            'is_hidden' => false,
            'moderated_by' => null,
            'moderation_reason' => null,
            'moderated_at' => null,
        ];
    }
}