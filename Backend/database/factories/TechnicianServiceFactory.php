<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Specialty;
use App\Models\TechnicianProfile;
use App\Models\TechnicianService;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TechnicianService>
 */
class TechnicianServiceFactory extends Factory
{
    protected $model = TechnicianService::class;

    public function definition(): array
    {
        return [
            'technician_profile_id' => TechnicianProfile::factory(),
            'specialty_id' => Specialty::factory(),
            'title' => 'Diagnóstico y reparación preventiva',
            'description' => 'Revisión completa de componentes y ajuste operativo.',
            'reference_price' => '350.00',
            'is_active' => true,
        ];
    }
}