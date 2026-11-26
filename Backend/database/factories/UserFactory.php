<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected $model = User::class;

    protected static ?string $password = null;

    public function definition(): array
    {
        return [
            'name' => 'Usuario Prueba ' . fake()->unique()->numerify('####'),
            'email' => 'usuario.' . fake()->unique()->numerify('######') . '@example.test',
            'email_verified_at' => now()->utc(),
            'password' => static::$password ??= Hash::make('Password123!'),
            'role' => UserRole::Client,
            'phone' => '938' . fake()->numerify('#######'),
            'status' => UserStatus::Active,
            'suspended_at' => null,
            'suspended_reason' => null,
            'remember_token' => Str::random(10),
        ];
    }

    public function unverified(): static
    {
        return $this->state(fn (): array => [
            'email_verified_at' => null,
        ]);
    }

    public function technician(): static
    {
        return $this->state(fn (): array => [
            'role' => UserRole::Technician,
        ]);
    }

    public function admin(): static
    {
        return $this->state(fn (): array => [
            'role' => UserRole::Admin,
            'phone' => null,
        ]);
    }

    public function suspended(string $reason = 'Incumplimiento operativo'): static
    {
        return $this->state(fn (): array => [
            'status' => UserStatus::Suspended,
            'suspended_at' => now()->utc(),
            'suspended_reason' => $reason,
        ]);
    }
}