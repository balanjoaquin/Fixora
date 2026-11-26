<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\ServiceRequestStatus;
use App\Models\ServiceRequest;
use App\Models\Specialty;
use App\Models\TechnicianProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ServiceRequest>
 */
class ServiceRequestFactory extends Factory
{
    protected $model = ServiceRequest::class;

    public function definition(): array
    {
        return [
            'client_id' => User::factory(),
            'technician_profile_id' => TechnicianProfile::factory(),
            'specialty_id' => Specialty::factory(),
            'technician_service_id' => null,
            'title' => 'Revisión de falla eléctrica en tablero',
            'description' => 'Interrupción intermitente en circuito principal.',
            'address_line' => 'Calle 26 #104, Col. Centro',
            'approx_zone' => 'Col. Centro',
            'latitude' => '18.6420000',
            'longitude' => '-91.8310000',
            'preferred_date' => now()->utc()->addDay()->toDateString(),
            'preferred_start' => '10:00:00',
            'status' => ServiceRequestStatus::Pending,
            'expires_at' => now()->utc()->addHours(48),
            'accepted_at' => null,
            'started_at' => null,
            'completed_at' => null,
            'closed_at' => null,
            'closed_by' => null,
            'closing_reason' => null,
        ];
    }
}