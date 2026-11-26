<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Enums\UserRole;
use App\Models\AvailabilitySlot;
use App\Models\Specialty;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use App\Services\ProfileVisibilityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_sends_email_verification_notification_and_leaves_user_unverified(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Cliente Nuevo',
            'email' => 'nuevo@example.test',
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
            'phone' => '9381112233',
            'role' => UserRole::Client->value,
        ]);

        $response->assertCreated();

        /** @var User $user */
        $user = User::query()->where('email', 'nuevo@example.test')->firstOrFail();
        $this->assertFalse($user->hasVerifiedEmail());

        Notification::assertSentTo($user, VerifyEmailNotification::class);
    }

    public function test_signed_verification_link_marks_email_verified_and_is_idempotent(): void
    {
        /** @var User $user */
        $user = User::factory()->unverified()->create();

        $url = URL::temporarySignedRoute(
            'api.v1.auth.email.verify',
            now()->addMinutes(60),
            [
                'id' => $user->id,
                'hash' => sha1($user->getEmailForVerification()),
            ]
        );

        $browserResponse = $this->get($url);
        $browserResponse->assertRedirect('http://localhost:3000/email-verified?status=success');

        $user->refresh();
        $this->assertTrue($user->hasVerifiedEmail());

        $jsonRepeat = $this->getJson($url);
        $jsonRepeat->assertOk()
            ->assertJsonPath('email_verified', true);
    }

    public function test_invalid_or_tampered_verification_link_is_rejected(): void
    {
        /** @var User $user */
        $user = User::factory()->unverified()->create();

        $badUrl = URL::temporarySignedRoute(
            'api.v1.auth.email.verify',
            now()->addMinutes(60),
            [
                'id' => $user->id,
                'hash' => sha1('otro@example.test'),
            ]
        );

        $this->getJson($badUrl)
            ->assertForbidden()
            ->assertJsonPath('code', 'invalid_verification_link');

        $this->get($badUrl)
            ->assertRedirect('http://localhost:3000/email-verified?status=invalid');

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_unverified_client_cannot_create_service_request_until_verified(): void
    {
        $specialty = Specialty::query()->create([
            'name' => 'Electricidad',
            'slug' => 'electricidad',
            'is_active' => true,
        ]);

        /** @var User $techUser */
        $techUser = User::factory()->technician()->create();
        /** @var TechnicianProfile $profile */
        $profile = TechnicianProfile::query()->create([
            'user_id' => $techUser->id,
            'headline' => 'Electricista residencial',
            'bio' => 'Instalaciones y reparaciones seguras.',
            'service_zone' => 'Centro',
            'years_experience' => 5,
            'latitude' => 18.6410,
            'longitude' => -91.8320,
            'is_visible' => true,
        ]);
        $profile->specialties()->attach($specialty->id);
        AvailabilitySlot::query()->create([
            'technician_profile_id' => $profile->id,
            'weekday' => 1,
            'start_time' => '08:00:00',
            'end_time' => '18:00:00',
        ]);

        /** @var User $client */
        $client = User::factory()->unverified()->create();
        Sanctum::actingAs($client);

        $nextMonday = now('America/Mexico_City')->next('Monday')->format('Y-m-d');

        $payload = [
            'technician_profile_id' => $profile->id,
            'specialty_id' => $specialty->id,
            'title' => 'Revisión de centro de carga',
            'description' => 'Se dispara una pastilla térmica.',
            'address_line' => 'Calle 24 #110',
            'approx_zone' => 'Colonia Centro',
            'preferred_date' => $nextMonday,
            'preferred_start' => '10:00',
        ];

        $this->postJson('/api/v1/requests', $payload)
            ->assertForbidden()
            ->assertJsonPath('code', 'email_not_verified');

        $verifyUrl = URL::temporarySignedRoute(
            'api.v1.auth.email.verify',
            now()->addMinutes(60),
            [
                'id' => $client->id,
                'hash' => sha1($client->getEmailForVerification()),
            ]
        );
        $this->getJson($verifyUrl)->assertOk();

        // Re-autenticar con el usuario actualizado desde la BD (ya con correo verificado)
        Sanctum::actingAs($client->fresh());

        $this->postJson('/api/v1/requests', $payload)
            ->assertCreated();
    }

    public function test_unverified_technician_remains_hidden_until_email_is_verified(): void
    {
        $specialty = Specialty::query()->create([
            'name' => 'Plomería',
            'slug' => 'plomeria',
            'is_active' => true,
        ]);

        /** @var User $techUser */
        $techUser = User::factory()->technician()->unverified()->create();

        /** @var TechnicianProfile $profile */
        $profile = TechnicianProfile::query()->create([
            'user_id' => $techUser->id,
            'headline' => 'Plomero certificado',
            'bio' => 'Fugas y tuberías.',
            'service_zone' => 'Playa Norte',
            'years_experience' => 4,
            'latitude' => 18.6500,
            'longitude' => -91.8200,
            'is_visible' => false,
        ]);
        $profile->specialties()->attach($specialty->id);
        AvailabilitySlot::query()->create([
            'technician_profile_id' => $profile->id,
            'weekday' => 2,
            'start_time' => '09:00:00',
            'end_time' => '17:00:00',
        ]);

        app(ProfileVisibilityService::class)->recalculate($profile);
        $this->assertFalse($profile->fresh()->is_visible);

        $this->getJson("/api/v1/technicians/{$profile->id}")->assertNotFound();

        $verifyUrl = URL::temporarySignedRoute(
            'api.v1.auth.email.verify',
            now()->addMinutes(60),
            [
                'id' => $techUser->id,
                'hash' => sha1($techUser->getEmailForVerification()),
            ]
        );
        $this->getJson($verifyUrl)->assertOk();

        $this->assertTrue($profile->fresh()->is_visible);
        $this->getJson("/api/v1/technicians/{$profile->id}")->assertOk();
    }

    public function test_resend_verification_respects_status_and_rate_limit(): void
    {
        Notification::fake();

        /** @var User $user */
        $user = User::factory()->unverified()->create();
        Sanctum::actingAs($user);

        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/v1/auth/email/resend')
                ->assertOk()
                ->assertJsonPath('email_verified', false);
        }

        Notification::assertSentToTimes($user, VerifyEmailNotification::class, 6);

        $this->postJson('/api/v1/auth/email/resend')
            ->assertStatus(429);

        /** @var User $verifiedUser */
        $verifiedUser = User::factory()->create();
        Sanctum::actingAs($verifiedUser);

        $this->postJson('/api/v1/auth/email/resend')
            ->assertOk()
            ->assertJsonPath('email_verified', true);

        Notification::assertNotSentTo($verifiedUser, VerifyEmailNotification::class);
    }
}