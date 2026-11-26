<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Specialty;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Specialty>
 */
class SpecialtyFactory extends Factory
{
    protected $model = Specialty::class;

    public function definition(): array
    {
        $code = fake()->unique()->numerify('#####');
        $name = 'Especialidad ' . $code;

        return [
            'name' => $name,
            'slug' => Str::slug($name),
            'icon' => 'wrench',
            'is_active' => true,
        ];
    }
}