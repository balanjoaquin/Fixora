<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\ServiceRequestStatus;
use App\Models\RequestEvent;
use App\Models\ServiceRequest;
use App\Models\Specialty;
use Carbon\Carbon;
use Database\Seeders\SpecialtySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class EndToEndTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SpecialtySeeder::class);
    }

    private function extractToken(array $responseData): string
    {
        $candidates = [$responseData['token'] ?? null,
            $responseData['plain_text_token'] ?? null,
            $responseData['access_token'] ?? null,
            $responseData['data']['token'] ?? null,
            $responseData['data']['plain_text_token'] ?? null,
            $responseData['data']['access_token'] ?? null,
        ];

        foreach ($candidates as$candidate) {
            if (is_string($candidate) &&$candidate !== '') {
                return $candidate;
            }
        }

        $this->fail('No se encontró un token válido en la respuesta de registro o login.');
    }

    private function verifyRegisteredUserEmail(int $userId, string$email): void
    {
        $verifyUrl = URL::temporarySignedRoute(
            'api.v1.auth.email.verify',
            now()->addMinutes(60),
            [
                'id' => $userId,
                'hash' => sha1(mb_strtolower(trim($email))),
            ]
        );

        $this->getJson($verifyUrl)->assertOk();$this->app['auth']->forgetGuards();
    }

    public function test_full_service_request_and_review_lifecycle_end_to_end(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 11, 20, 9, 0, 0, 'America/Mexico_City'));

        $specialty = Specialty::query()->where('is_active', true)->firstOrFail();

        $techReg =$this->postJson('/api/v1/auth/register', [
            'name' => 'Carlos Méndez',
            'email' => 'carlos.e2e@example.com',
            'phone' => '9381002030',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'technician',
        ])->assertCreated();

        $this->app['auth']->forgetGuards();$techToken = $this->extractToken($techReg->json());
        $this->verifyRegisteredUserEmail((int)$techReg->json('data.user.id'), 'carlos.e2e@example.com');

        $this->withToken($techToken)->putJson('/api/v1/technician/profile', [
            'headline' => 'Técnico en climatización y electricidad',
            'bio' => 'Diagnóstico y mantenimiento preventivo en hogar y comercio.',
            'service_zone' => 'Playa Norte',
            'years_experience' => 6,
            'latitude' => 18.651234,
            'longitude' => -91.834567,
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($techToken)->putJson('/api/v1/technician/specialties', [
            'specialty_ids' => [$specialty->id],
        ])->assertOk();

        $this->app['auth']->forgetGuards();$serviceRes = $this->withToken($techToken)->postJson('/api/v1/technician/services', [
            'specialty_id' => $specialty->id,
            'title' => 'Revisión y mantenimiento general',
            'description' => 'Inspección completa del equipo y reporte de estado.',
            'base_price' => 450.00,
        ])->assertCreated();

        $serviceId = (int)$serviceRes->json('data.id');

        $tomorrowDate = Carbon::now()->addDay()->toDateString();
        $weekday = (int) Carbon::parse($tomorrowDate)->dayOfWeek;

        $this->app['auth']->forgetGuards();
        $this->withToken($techToken)->putJson('/api/v1/technician/availability', [
            'slots' => [[
                'weekday' => $weekday,
                'start_time' => '09:00',
                'end_time' => '14:00',
            ]],
        ])->assertOk();

        $this->app['auth']->forgetGuards();$searchRes = $this->getJson("/api/v1/technicians?specialty_id={$specialty->id}&lat=18.6510&lng=-91.8340&radius_km=10")
            ->assertOk();

        $profileId = (int)$searchRes->json('data.0.id');
        $this->assertGreaterThan(0,$profileId);

        $this->app['auth']->forgetGuards();$publicProfile = $this->getJson("/api/v1/technicians/{$profileId}")->assertOk();
        $publicProfile->assertJsonMissingPath('data.email')
            ->assertJsonMissingPath('data.phone')
            ->assertJsonMissingPath('data.user_id');

        $this->app['auth']->forgetGuards();
        $clientReg =$this->postJson('/api/v1/auth/register', [
            'name' => 'Sofía Herrera',
            'email' => 'sofia.e2e@example.com',
            'phone' => '9384005060',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'client',
        ])->assertCreated();

        $this->app['auth']->forgetGuards();$clientToken = $this->extractToken($clientReg->json());
        $this->verifyRegisteredUserEmail((int)$clientReg->json('data.user.id'), 'sofia.e2e@example.com');

        $createReq = $this->withToken($clientToken)->postJson('/api/v1/requests', [
            'technician_profile_id' => $profileId,
            'specialty_id' => $specialty->id,
            'technician_service_id' => $serviceId,
            'title' => 'Mantenimiento preventivo de equipo',
            'description' => 'Revisión general y limpieza de componentes.',
            'address_line' => 'Calle 33 #120, Playa Norte',
            'approx_zone' => 'Playa Norte',
            'preferred_date' => $tomorrowDate,
            'preferred_start' => '10:00',
            'latitude' => 18.6520,
            'longitude' => -91.8330,
        ])->assertCreated();

        $requestId = (int) $createReq->json('data.id');$this->assertStringNotContainsString('Calle 33 #120, Playa Norte', $createReq->getContent());
        $this->assertStringNotContainsString('9381002030',$createReq->getContent());

        $this->app['auth']->forgetGuards();
        $acceptRes =$this->withToken($techToken)->postJson("/api/v1/requests/{$requestId}/accept")
            ->assertOk();

        $this->assertStringContainsString('Calle 33 #120, Playa Norte', $acceptRes->getContent());
        $this->assertStringContainsString('9384005060',$acceptRes->getContent());

        Carbon::setTestNow(Carbon::parse("{$tomorrowDate} 10:15:00", 'America/Mexico_City'));

        $this->app['auth']->forgetGuards();$this->withToken($techToken)->postJson("/api/v1/requests/{$requestId}/start")->assertOk();

        $this->app['auth']->forgetGuards();$this->withToken($techToken)->postJson("/api/v1/requests/{$requestId}/complete")->assertOk();

        $this->assertSame(1, (int) ServiceRequest::query()->findOrFail($requestId)->technicianProfile->completed_count);

        $this->app['auth']->forgetGuards();$this->withToken($clientToken)->postJson("/api/v1/requests/{$requestId}/review", [
            'rating' => 5,
            'comment' => '<b>Servicio puntual y limpio.</b>',
        ])->assertCreated()->assertJsonPath('data.comment', 'Servicio puntual y limpio.');

        $reviewId = (int) ServiceRequest::query()->findOrFail($requestId)->review->id;

        $this->app['auth']->forgetGuards();$this->withToken($techToken)->postJson("/api/v1/reviews/{$reviewId}/reply", [
            'body' => '<i>Gracias por su confianza.</i>',
        ])->assertOk()->assertJsonPath('data.technician_reply', 'Gracias por su confianza.');

        $this->app['auth']->forgetGuards();
        $this->getJson("/api/v1/technicians/{$profileId}/reviews")
            ->assertOk()
            ->assertJsonPath('summary.rating_avg', '5.00')
            ->assertJsonPath('summary.rating_count', 1);

        $events = RequestEvent::query()
            ->where('service_request_id', $requestId)
            ->orderBy('id')
            ->get();

        $this->assertGreaterThanOrEqual(4,$events->count());
        $this->assertSame(ServiceRequestStatus::Completed, ServiceRequest::query()->findOrFail($requestId)->status);

        Carbon::setTestNow();
    }

    public function test_alternate_paths_rejection_cancellation_expiration_and_review_guard(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 11, 20, 9, 0, 0, 'America/Mexico_City'));
        $specialty = Specialty::query()->where('is_active', true)->firstOrFail();

        $techReg =$this->postJson('/api/v1/auth/register', [
            'name' => 'Luis Ortega',
            'email' => 'luis.alt@example.com',
            'phone' => '9381112233',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'technician',
        ])->assertCreated();

        $this->app['auth']->forgetGuards();$techToken = $this->extractToken($techReg->json());
        $this->verifyRegisteredUserEmail((int)$techReg->json('data.user.id'), 'luis.alt@example.com');

        $this->withToken($techToken)->putJson('/api/v1/technician/profile', [
            'headline' => 'Técnico multiservicio',
            'bio' => 'Atención en zona centro.',
            'service_zone' => 'Centro',
            'years_experience' => 4,
            'latitude' => 18.6410,
            'longitude' => -91.8310,
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($techToken)->putJson('/api/v1/technician/specialties', [
            'specialty_ids' => [$specialty->id],
        ])->assertOk();

        $this->app['auth']->forgetGuards();$serviceId = (int) $this->withToken($techToken)->postJson('/api/v1/technician/services', [
            'specialty_id' => $specialty->id,
            'title' => 'Diagnóstico',
            'description' => 'Revisión inicial.',
            'base_price' => 300.00,
        ])->assertCreated()->json('data.id');

        $tomorrowDate = Carbon::now()->addDay()->toDateString();
        $weekday = (int) Carbon::parse($tomorrowDate)->dayOfWeek;

        $this->app['auth']->forgetGuards();
        $this->withToken($techToken)->putJson('/api/v1/technician/availability', [
            'slots' => [[
                'weekday' => $weekday,
                'start_time' => '08:00',
                'end_time' => '18:00',
            ]],
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $profileId = (int)$this->getJson('/api/v1/technicians')->json('data.0.id');

        $this->app['auth']->forgetGuards();
        $clientReg =$this->postJson('/api/v1/auth/register', [
            'name' => 'Elena Ríos',
            'email' => 'elena.alt@example.com',
            'phone' => '9384445566',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'client',
        ])->assertCreated();

        $this->app['auth']->forgetGuards();$clientToken = $this->extractToken($clientReg->json());
        $this->verifyRegisteredUserEmail((int)$clientReg->json('data.user.id'), 'elena.alt@example.com');

        $payload = [
            'technician_profile_id' => $profileId,
            'specialty_id' => $specialty->id,
            'technician_service_id' => $serviceId,
            'title' => 'Revisión técnica programada',
            'description' => 'Inspección general del equipo.',
            'address_line' => 'Av. 56 #45, Centro',
            'approx_zone' => 'Centro',
            'preferred_date' => $tomorrowDate,
            'preferred_start' => '10:00',
            'latitude' => 18.6415,
            'longitude' => -91.8315,
        ];

        $reqRejected = (int)$this->withToken($clientToken)->postJson('/api/v1/requests',$payload)->assertCreated()->json('data.id');

        $this->app['auth']->forgetGuards();$this->withToken($techToken)->postJson("/api/v1/requests/{$reqRejected}/reject", [
            'reason' => 'Sin disponibilidad en ese horario',
        ])->assertOk();

        $this->app['auth']->forgetGuards();$this->withToken($clientToken)->postJson("/api/v1/requests/{$reqRejected}/review", ['rating' => 5])->assertStatus(409);

        $this->app['auth']->forgetGuards();
        $reqCancelledByClient = (int)$this->withToken($clientToken)->postJson('/api/v1/requests',$payload)->assertCreated()->json('data.id');

        $this->app['auth']->forgetGuards();$this->withToken($clientToken)->postJson("/api/v1/requests/{$reqCancelledByClient}/cancel")->assertOk();

        $this->app['auth']->forgetGuards();$this->withToken($clientToken)->postJson("/api/v1/requests/{$reqCancelledByClient}/review", ['rating' => 5])->assertStatus(409);

        $this->app['auth']->forgetGuards();
        $reqCancelledByTech = (int)$this->withToken($clientToken)->postJson('/api/v1/requests',$payload)->assertCreated()->json('data.id');

        $this->app['auth']->forgetGuards();$this->withToken($techToken)->postJson("/api/v1/requests/{$reqCancelledByTech}/accept")->assertOk();

        $this->app['auth']->forgetGuards();$this->withToken($techToken)->postJson("/api/v1/requests/{$reqCancelledByTech}/cancel", [
            'reason' => 'Imprevisto operativo',
        ])->assertOk();

        $this->app['auth']->forgetGuards();$this->withToken($clientToken)->postJson("/api/v1/requests/{$reqCancelledByTech}/review", ['rating' => 5])->assertStatus(409);

        $this->app['auth']->forgetGuards();
        $reqExpired = (int)$this->withToken($clientToken)->postJson('/api/v1/requests',$payload)->assertCreated()->json('data.id');

        Carbon::setTestNow(Carbon::now()->addHours(49));
        $this->artisan('fixora:expire-requests')->assertExitCode(0);
        $this->assertSame(ServiceRequestStatus::Expired, ServiceRequest::query()->findOrFail($reqExpired)->status);

        $this->app['auth']->forgetGuards();$this->withToken($clientToken)->postJson("/api/v1/requests/{$reqExpired}/review", ['rating' => 5])->assertStatus(409);

        Carbon::setTestNow();
    }
}