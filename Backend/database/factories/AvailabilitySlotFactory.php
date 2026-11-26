<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\AvailabilitySlot;
use App\Models\TechnicianProfile;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AvailabilitySlot>
 */
class AvailabilitySlotFactory extends Factory
{
    protected $model = AvailabilitySlot::class;

    public function definition(): array
    {
        return [
            'technician_profile_id' => TechnicianProfile::factory(),
            'weekday' => 1,
            'start_time' => '09:00:00',
            'end_time' => '13:00:00',
        ];
    }
}