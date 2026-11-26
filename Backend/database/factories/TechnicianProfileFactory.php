<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\TechnicianProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TechnicianProfile>
 */
class TechnicianProfileFactory extends Factory
{
    protected $model = TechnicianProfile::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory()->technician(),
            'headline' => 'Técnico certificado en mantenimiento general',
            'bio' => 'Atención en instalaciones y reparaciones residenciales.',
            'years_experience' => 3,
            'service_zone' => 'Zona Centro',
            'latitude' => '18.6414000',
            'longitude' => '-91.8323000',
            'service_radius_km' => 10,
            'is_visible' => true,
            'verified_at' => now()->utc(),
            'rating_avg' => '0.00',
            'rating_count' => 0,
            'completed_count' => 0,
        ];
    }
}