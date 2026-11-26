<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\TechnicianProfile;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthService
{
    private const LOGIN_MAX_ATTEMPTS = 5;
    private const LOGIN_DECAY_SECONDS = 300;

    /**
     * @param array{name: string, email: string, password: string, phone: string, role: string} $data
     * @return array{user: User, token: string}
     */
    public function register(array $data): array
    {
        $result = DB::transaction(function () use ($data): array {
            $role = UserRole::from($data['role']);

            $user = User::query()->create([
                'name' => trim($data['name']),
                'email' => Str::lower(trim($data['email'])),
                'email_verified_at' => null,
                'password' => $data['password'],
                'role' => $role,
                'phone' => $this->normalizePhone($data['phone']),
                'status' => UserStatus::Active,
            ]);

            if ($role === UserRole::Technician) {
                TechnicianProfile::query()->create([
                    'user_id' => $user->id,
                    'years_experience' => 0,
                    'is_visible' => false,
                    'rating_avg' => 0,
                    'rating_count' => 0,
                    'completed_count' => 0,
                ]);
            }

            $token = $user->createToken('auth-token')->plainTextToken;

            return [
                'user' => $user->load('technicianProfile'),
                'token' => $token,
            ];
        });

        $result['user']->sendEmailVerificationNotification();

        return $result;
    }

    /**
     * @return array{user: User, token: string}
     */
    public function login(string $email, string $password, string $ipAddress): array
    {
        $normalizedEmail = Str::lower(trim($email));
        $throttleKey = $this->loginThrottleKey($normalizedEmail, $ipAddress);

        if (RateLimiter::tooManyAttempts($throttleKey, self::LOGIN_MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            throw new ThrottleRequestsException(
                "Demasiados intentos fallidos. Intenta nuevamente en {$seconds} segundos.",
                null,
                ['Retry-After' => $seconds]
            );
        }

        /** @var User|null $user */
        $user = User::query()->where('email', $normalizedEmail)->first();

        if ($user === null || $user->role === UserRole::Admin || !Hash::check($password, $user->password)) {
            RateLimiter::hit($throttleKey, self::LOGIN_DECAY_SECONDS);

            throw ValidationException::withMessages([
                'email' => ['Credenciales incorrectas.'],
            ]);
        }

        if ($user->status === UserStatus::Suspended) {
            RateLimiter::clear($throttleKey);

            throw new AuthorizationException(
                'Tu cuenta se encuentra suspendida. Contacta a soporte para más información.'
            );
        }

        RateLimiter::clear($throttleKey);

        $token = $user->createToken('auth-token')->plainTextToken;

        return [
            'user' => $user->load('technicianProfile'),
            'token' => $token,
        ];
    }

    public function logout(User $user): void
    {
        $user->currentAccessToken()?->delete();
    }

    public function normalizePhone(string $phone): string
    {
        return preg_replace('/[\s\-]+/', '', trim($phone)) ?? '';
    }

    private function loginThrottleKey(string $email, string $ipAddress): string
    {
        return 'login:' . sha1($email . '|' . $ipAddress);
    }
}