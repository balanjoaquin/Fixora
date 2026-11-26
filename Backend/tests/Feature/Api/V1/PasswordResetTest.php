<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\User;
use App\Notifications\PasswordChangedNotification;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_forgot_password_returns_identical_response_and_only_mails_active_non_admin_users(): void
    {
        Notification::fake();

        /** @var User $activeUser */
        $activeUser = User::factory()->create(['email' => 'cliente@example.test']);
        /** @var User $suspendedUser */
        $suspendedUser = User::factory()->suspended()->create(['email' => 'suspendido@example.test']);
        /** @var User $adminUser */
        $adminUser = User::factory()->admin()->create(['email' => 'admin@example.test']);

        $expectedMessage = 'Si el correo existe, te enviamos instrucciones.';

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'cliente@example.test'])
            ->assertOk()
            ->assertExactJson(['message' => $expectedMessage]);

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'inexistente@example.test'])
            ->assertOk()
            ->assertExactJson(['message' => $expectedMessage]);

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'suspendido@example.test'])
            ->assertOk()
            ->assertExactJson(['message' => $expectedMessage]);

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'admin@example.test'])
            ->assertOk()
            ->assertExactJson(['message' => $expectedMessage]);

        Notification::assertSentTo($activeUser, ResetPasswordNotification::class);
        Notification::assertNotSentTo($suspendedUser, ResetPasswordNotification::class);
        Notification::assertNotSentTo($adminUser, ResetPasswordNotification::class);
    }

    public function test_forgot_password_is_rate_limited(): void
    {
        Notification::fake();
        User::factory()->create(['email' => 'limite@example.test']);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/forgot-password', ['email' => 'limite@example.test'])
                ->assertOk();
        }

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'limite@example.test'])
            ->assertStatus(429);
    }

    public function test_reset_password_updates_password_revokes_tokens_and_invalidates_reset_token(): void
    {
        Notification::fake();

        /** @var User $user */
        $user = User::factory()->create([
            'email' => 'recuperar@example.test',
            'password' => 'AntiguaClave123',
        ]);

        $user->createToken('sesion-1');
        $user->createToken('sesion-2');
        $this->assertSame(2, $user->tokens()->count());

        $token = Password::broker()->createToken($user);

        $payload = [
            'token' => $token,
            'email' => 'recuperar@example.test',
            'password' => 'NuevaClave456',
            'password_confirmation' => 'NuevaClave456',
        ];

        $response = $this->postJson('/api/v1/auth/reset-password', $payload);
        $response->assertOk()
            ->assertJsonMissingPath('data.token');

        $user->refresh();
        $this->assertTrue(Hash::check('NuevaClave456', $user->password));
        $this->assertSame(0, $user->tokens()->count());

        Notification::assertSentTo($user, PasswordChangedNotification::class);

        // No se permite reutilizar el mismo token
        $this->postJson('/api/v1/auth/reset-password', $payload)
            ->assertStatus(422);
    }

    public function test_reset_password_rejects_invalid_token_or_weak_password(): void
    {
        /** @var User $user */
        $user = User::factory()->create(['email' => 'debil@example.test']);
        $token = Password::broker()->createToken($user);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'email' => 'debil@example.test',
            'password' => 'corta',
            'password_confirmation' => 'corta',
        ])->assertStatus(422);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => 'token-falso',
            'email' => 'debil@example.test',
            'password' => 'ClaveValida123',
            'password_confirmation' => 'ClaveValida123',
        ])->assertStatus(422);
    }
}