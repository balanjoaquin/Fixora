<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Specialty;
use Illuminate\Database\Seeder;

class SpecialtySeeder extends Seeder
{
    public function run(): void
    {
        $specialties = [
            [
                'name' => 'Electricidad',
                'slug' => 'electricidad',
                'icon' => 'zap',
            ],
            [
                'name' => 'Plomería',
                'slug' => 'plomeria',
                'icon' => 'droplets',
            ],
            [
                'name' => 'Aire acondicionado y refrigeración',
                'slug' => 'aire-acondicionado-refrigeracion',
                'icon' => 'snowflake',
            ],
            [
                'name' => 'Computación',
                'slug' => 'computacion',
                'icon' => 'laptop',
            ],
            [
                'name' => 'Carpintería',
                'slug' => 'carpinteria',
                'icon' => 'hammer',
            ],
            [
                'name' => 'Reparación de equipos',
                'slug' => 'reparacion-de-equipos',
                'icon' => 'wrench',
            ],
        ];

        foreach ($specialties as $specialty) {
            Specialty::query()->updateOrCreate(
                ['slug' => $specialty['slug']],
                [
                    'name' => $specialty['name'],
                    'icon' => $specialty['icon'],
                    'is_active' => true,
                ]
            );
        }
    }
}