<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Enums\ServiceRequestStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AvailabilitySlot;
use App\Models\RequestEvent;
use App\Models\ServiceRequest;
use App\Models\Specialty;
use App\Models\TechnicianProfile;
use App\Models\TechnicianService;
use App\Models\User;
use App\Services\ProfileVisibilityService;
use Database\Seeders\SpecialtySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use RuntimeException;
use Tests\TestCase;

class ServiceRequestApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SpecialtySeeder::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /**
     * @return array{user: User, profile: TechnicianProfile, specialty: Specialty, service: TechnicianService}
     */
    private function createReadyTechnician(
        string $name = 'Carlos Méndez',
        string $email = 'carlos.tech@fixora.test',
        string $phone = '9381112233',
        array $weekdays = [1, 2, 3, 4, 5],
        string $startTime = '09:00',
        string $endTime = '17:00',
    ): array {
        $specialty = Specialty::query()->orderBy('id')->firstOrFail();

        /** @var User $user */
        $user = User::factory()->create([
            'name' => $name,
            'email' => $email,
            'role' => UserRole::Technician,
            'status' => UserStatus::Active,
            'phone' => $phone,
        ]);

        /** @var TechnicianProfile $profile */
        $profile = TechnicianProfile::factory()->create([
            'user_id' => $user->id,
            'headline' => 'Técnico especialista en Ciudad del Carmen',
            'bio' => 'Atención residencial y comercial con garantía.',
            'years_experience' => 5,
            'service_zone' => 'Playa Norte, Ciudad del Carmen',
            'latitude' => 18.6530000,
            'longitude' => -91.8340000,
            'service_radius_km' => 10,
            'is_visible' => false,
            'rating_avg' => 4.80,
            'rating_count' => 10,
            'completed_count' => 0,
            'verified_at' => now(),
        ]);

        $profile->specialties()->sync([$specialty->id]);

        /** @var TechnicianService $service */
        $service = TechnicianService::factory()->create([
            'technician_profile_id' => $profile->id,
            'specialty_id' => $specialty->id,
            'title' => 'Diagnóstico y reparación eléctrica',
            'reference_price' => '450.00',
            'is_active' => true,
        ]);

        foreach ($weekdays as $weekday) {
            AvailabilitySlot::factory()->create([
                'technician_profile_id' => $profile->id,
                'weekday' => $weekday,
                'start_time' => $startTime,
                'end_time' => $endTime,
            ]);
        }

        app(ProfileVisibilityService::class)->recalculate($profile);

        return [
            'user' => $user->fresh(),
            'profile' => $profile->fresh(),
            'specialty' => $specialty,
            'service' => $service,
        ];
    }

    private function createClient(
        string $name = 'Laura Gómez',
        string $email = 'laura.client@fixora.test',
        string $phone = '9384445566',
    ): User {
        /** @var User $client */
        $client = User::factory()->create([
            'name' => $name,
            'email' => $email,
            'role' => UserRole::Client,
            'status' => UserStatus::Active,
            'phone' => $phone,
        ]);

        return $client;
    }

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function validPayload(TechnicianProfile $profile, int $specialtyId, ?int $serviceId = null, array $overrides = []): array
    {
        return array_merge([
            'technician_profile_id' => $profile->id,
            'specialty_id' => $specialtyId,
            'technician_service_id' => $serviceId,
            'title' => 'Revisión de tablero eléctrico residencial',
            'description' => 'Se dispara la pastilla principal al encender el aire acondicionado.',
            'address_line' => 'Calle 56 #124, Col. Petrolera, Ciudad del Carmen',
            'approx_zone' => 'Colonia Petrolera, Ciudad del Carmen',
            'latitude' => 18.6451234,
            'longitude' => -91.8219876,
            'preferred_date' => '2026-11-19',
            'preferred_start' => '10:00',
        ], $overrides);
    }

    private function setLocalTestNow(string $localDateTime = '2026-11-18 10:00:00'): void
    {
        Carbon::setTestNow(Carbon::parse($localDateTime, 'America/Mexico_City'));
    }

    // -------------------------------------------------------------------------
    // CREACIÓN
    // -------------------------------------------------------------------------

    public function test_client_creates_valid_request_in_pending_with_48h_expiration_and_initial_event(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $token = $client->createToken('client')->plainTextToken;

        $response = $this->withToken($token)->postJson(
            '/api/v1/requests',
            $this->validPayload($tech['profile'], $tech['specialty']->id, $tech['service']->id)
        );

        $response->assertStatus(201)
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.preferred_date', '2026-11-19')
            ->assertJsonPath('data.preferred_start', '10:00')
            ->assertJsonCount(1, 'data.events')
            ->assertJsonPath('data.events.0.from_status', null)
            ->assertJsonPath('data.events.0.to_status', 'pending')
            ->assertJsonPath('data.events.0.actor_role', 'client');

        $requestId = (int) $response->json('data.id');
        /** @var ServiceRequest $created */
        $created = ServiceRequest::query()->findOrFail($requestId);

        $expectedExpiresAtUtc = Carbon::now('UTC')->addHours(48)->toIso8601String();
        $this->assertSame($expectedExpiresAtUtc, $created->expires_at->utc()->toIso8601String());

        $this->assertDatabaseHas('request_events', [
            'service_request_id' => $requestId,
            'from_status' => null,
            'to_status' => 'pending',
            'actor_id' => $client->id,
            'actor_role' => 'client',
        ]);
    }

    public function test_technician_cannot_create_service_request_returns_403(): void
    {
        $this->setLocalTestNow();
        $techA = $this->createReadyTechnician('Tech A', 'techa@fixora.test');
        $techB = $this->createReadyTechnician('Tech B', 'techb@fixora.test');
        $token = $techA['user']->createToken('tech')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/requests', $this->validPayload($techB['profile'], $techB['specialty']->id))
            ->assertStatus(403);
    }

    public function test_non_visible_or_suspended_technician_returns_404_on_create(): void
    {
        $this->setLocalTestNow();
        $client = $this->createClient();
        $token = $client->createToken('client')->plainTextToken;

        $hidden = $this->createReadyTechnician('Oculto', 'oculto@fixora.test');
        $hidden['profile']->update(['is_visible' => false]);

        $this->withToken($token)
            ->postJson('/api/v1/requests', $this->validPayload($hidden['profile'], $hidden['specialty']->id))
            ->assertStatus(404);

        $suspended = $this->createReadyTechnician('Suspendido', 'suspendido@fixora.test');
        $suspended['user']->update(['status' => UserStatus::Suspended]);

        $this->withToken($token)
            ->postJson('/api/v1/requests', $this->validPayload($suspended['profile'], $suspended['specialty']->id))
            ->assertStatus(404);
    }

    public function test_unassigned_specialty_fails_validation(): void
    {
        $this->setLocalTestNow();
        $tech = $this->createReadyTechnician();
        $otherSpecialty = Specialty::query()->whereKeyNot($tech['specialty']->id)->firstOrFail();
        $client = $this->createClient();
        $token = $client->createToken('client')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/requests', $this->validPayload($tech['profile'], $otherSpecialty->id))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['specialty_id']);
    }

    public function test_service_from_another_technician_fails_validation(): void
    {
        $this->setLocalTestNow();
        $techA = $this->createReadyTechnician('Tech A', 'techa@fixora.test');
        $techB = $this->createReadyTechnician('Tech B', 'techb@fixora.test');
        $client = $this->createClient();
        $token = $client->createToken('client')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/requests', $this->validPayload(
                $techA['profile'],
                $techA['specialty']->id,
                $techB['service']->id
            ))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['technician_service_id']);
    }

    public function test_inactive_service_fails_validation(): void
    {
        $this->setLocalTestNow();
        $tech = $this->createReadyTechnician();
        $tech['service']->update(['is_active' => false]);
        $client = $this->createClient();
        $token = $client->createToken('client')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/requests', $this->validPayload(
                $tech['profile'],
                $tech['specialty']->id,
                $tech['service']->id
            ))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['technician_service_id']);
    }

    public function test_past_date_fails_validation(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $token = $client->createToken('client')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/requests', $this->validPayload(
                $tech['profile'],
                $tech['specialty']->id,
                null,
                ['preferred_date' => '2026-11-17']
            ))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['preferred_date']);
    }

    public function test_date_beyond_60_days_fails_validation(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician(weekdays: [1, 2, 3, 4, 5, 6, 7]);
        $client = $this->createClient();
        $token = $client->createToken('client')->plainTextToken;

        // 2026-11-18 + 61 días = 2027-01-18
        $this->withToken($token)
            ->postJson('/api/v1/requests', $this->validPayload(
                $tech['profile'],
                $tech['specialty']->id,
                null,
                ['preferred_date' => '2027-01-18']
            ))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['preferred_date']);
    }

    public function test_time_outside_technician_availability_fails_validation(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician(startTime: '09:00', endTime: '17:00');
        $client = $this->createClient();
        $token = $client->createToken('client')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/requests', $this->validPayload(
                $tech['profile'],
                $tech['specialty']->id,
                null,
                ['preferred_date' => '2026-11-19', 'preferred_start' => '18:00']
            ))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['preferred_start']);
    }

    public function test_time_at_slot_end_boundary_fails_and_slot_start_boundary_succeeds(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician(startTime: '09:00', endTime: '13:00');
        $client = $this->createClient();
        $token = $client->createToken('client')->plainTextToken;

        // Límite final exclusivo (13:00) -> 422
        $this->withToken($token)
            ->postJson('/api/v1/requests', $this->validPayload(
                $tech['profile'],
                $tech['specialty']->id,
                null,
                ['preferred_date' => '2026-11-19', 'preferred_start' => '13:00']
            ))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['preferred_start']);

        // Límite inicial inclusivo (09:00) -> 201
        $this->withToken($token)
            ->postJson('/api/v1/requests', $this->validPayload(
                $tech['profile'],
                $tech['specialty']->id,
                null,
                ['preferred_date' => '2026-11-19', 'preferred_start' => '09:00']
            ))
            ->assertStatus(201);
    }

    public function test_rate_limit_of_10_created_requests_per_hour_per_user(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician(weekdays: [1, 2, 3, 4, 5, 6, 7]);
        $client = $this->createClient();
        $token = $client->createToken('client')->plainTextToken;

        for ($i = 0; $i < 10; $i++) {
            $date = Carbon::parse('2026-11-19', 'America/Mexico_City')->addDays($i)->format('Y-m-d');
            $this->withToken($token)
                ->postJson('/api/v1/requests', $this->validPayload(
                    $tech['profile'],
                    $tech['specialty']->id,
                    null,
                    ['preferred_date' => $date, 'preferred_start' => '10:00']
                ))
                ->assertStatus(201);
        }

        $this->withToken($token)
            ->postJson('/api/v1/requests', $this->validPayload(
                $tech['profile'],
                $tech['specialty']->id,
                null,
                ['preferred_date' => '2026-12-01', 'preferred_start' => '10:00']
            ))
            ->assertStatus(429);
    }

    // -------------------------------------------------------------------------
    // TRANSICIONES PERMITIDAS (1 prueba por cada transición)
    // -------------------------------------------------------------------------

    public function test_transition_pending_to_accepted(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $reqId = $this->createPendingRequestViaApi($client, $tech);

        $this->app['auth']->forgetGuards();
        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        $this->withToken($techToken)
            ->postJson("/api/v1/requests/{$reqId}/accept")
            ->assertOk()
            ->assertJsonPath('data.status', 'accepted');

        $this->assertNotNull(ServiceRequest::query()->findOrFail($reqId)->accepted_at);
    }

    public function test_transition_pending_to_rejected(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $reqId = $this->createPendingRequestViaApi($client, $tech);

        $this->app['auth']->forgetGuards();
        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        $this->withToken($techToken)
            ->postJson("/api/v1/requests/{$reqId}/reject", ['reason' => 'Agenda saturada en esa zona.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected')
            ->assertJsonPath('data.closing_reason', 'Agenda saturada en esa zona.');

        $fresh = ServiceRequest::query()->findOrFail($reqId);
        $this->assertNotNull($fresh->closed_at);
        $this->assertSame($tech['user']->id, (int) $fresh->closed_by);
    }

    public function test_transition_pending_to_cancelled_by_client(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $clientToken = $client->createToken('client')->plainTextToken;

        $reqId = (int) $this->withToken($clientToken)
            ->postJson('/api/v1/requests', $this->validPayload($tech['profile'], $tech['specialty']->id))
            ->assertStatus(201)
            ->json('data.id');

        // En pending reason es opcional
        $this->withToken($clientToken)
            ->postJson("/api/v1/requests/{$reqId}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        $fresh = ServiceRequest::query()->findOrFail($reqId);
        $this->assertNotNull($fresh->closed_at);
        $this->assertSame($client->id, (int) $fresh->closed_by);
    }

    public function test_transition_pending_to_expired_by_system(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $reqId = $this->createPendingRequestViaApi($client, $tech);

        // Avanzar 48 horas exactas
        $this->setLocalTestNow('2026-11-20 10:00:00');
        $this->artisan('fixora:expire-requests')->assertExitCode(0);

        $fresh = ServiceRequest::query()->findOrFail($reqId);
        $this->assertSame(ServiceRequestStatus::Expired, $fresh->status);
        $this->assertNotNull($fresh->closed_at);
        $this->assertNull($fresh->closed_by);
    }

    public function test_transition_accepted_to_in_progress(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $reqId = $this->createPendingRequestViaApi($client, $tech);

        $this->app['auth']->forgetGuards();
        $techToken = $tech['user']->createToken('tech')->plainTextToken;
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/accept")->assertOk();

        // Llega el día programado (2026-11-19)
        $this->setLocalTestNow('2026-11-19 09:55:00');
        $this->withToken($techToken)
            ->postJson("/api/v1/requests/{$reqId}/start")
            ->assertOk()
            ->assertJsonPath('data.status', 'in_progress');

        $this->assertNotNull(ServiceRequest::query()->findOrFail($reqId)->started_at);
    }

    public function test_transition_accepted_to_cancelled_by_client_and_by_technician(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $clientToken = $client->createToken('client')->plainTextToken;

        $reqOne = (int) $this->withToken($clientToken)
            ->postJson('/api/v1/requests', $this->validPayload($tech['profile'], $tech['specialty']->id, null, ['preferred_date' => '2026-11-19']))
            ->assertStatus(201)
            ->json('data.id');

        $reqTwo = (int) $this->withToken($clientToken)
            ->postJson('/api/v1/requests', $this->validPayload($tech['profile'], $tech['specialty']->id, null, ['preferred_date' => '2026-11-20']))
            ->assertStatus(201)
            ->json('data.id');

        $this->app['auth']->forgetGuards();
        $techToken = $tech['user']->createToken('tech')->plainTextToken;
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqOne}/accept")->assertOk();
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqTwo}/accept")->assertOk();

        // Cancelación por técnico en accepted
        $this->withToken($techToken)
            ->postJson("/api/v1/requests/{$reqOne}/cancel", ['reason' => 'Emergencia médica del técnico.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        // Cancelación por cliente en accepted
        $this->app['auth']->forgetGuards();
        $this->withToken($clientToken)
            ->postJson("/api/v1/requests/{$reqTwo}/cancel", ['reason' => 'Reagendaré la próxima semana.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');
    }

    public function test_transition_in_progress_to_completed(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $reqId = $this->createPendingRequestViaApi($client, $tech);

        $this->app['auth']->forgetGuards();
        $techToken = $tech['user']->createToken('tech')->plainTextToken;
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/accept")->assertOk();

        $this->setLocalTestNow('2026-11-19 10:00:00');
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/start")->assertOk();

        $this->withToken($techToken)
            ->postJson("/api/v1/requests/{$reqId}/complete")
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $this->assertNotNull(ServiceRequest::query()->findOrFail($reqId)->completed_at);
    }

    public function test_transition_in_progress_to_cancelled_by_client_and_by_technician(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $clientToken = $client->createToken('client')->plainTextToken;

        $reqOne = (int) $this->withToken($clientToken)
            ->postJson('/api/v1/requests', $this->validPayload($tech['profile'], $tech['specialty']->id, null, ['preferred_date' => '2026-11-19']))
            ->assertStatus(201)
            ->json('data.id');

        $reqTwo = (int) $this->withToken($clientToken)
            ->postJson('/api/v1/requests', $this->validPayload($tech['profile'], $tech['specialty']->id, null, ['preferred_date' => '2026-11-20']))
            ->assertStatus(201)
            ->json('data.id');

        $this->app['auth']->forgetGuards();
        $techToken = $tech['user']->createToken('tech')->plainTextToken;
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqOne}/accept")->assertOk();
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqTwo}/accept")->assertOk();

        $this->setLocalTestNow('2026-11-20 10:00:00');
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqOne}/start")->assertOk();
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqTwo}/start")->assertOk();

        // Cancelación por técnico en in_progress
        $this->withToken($techToken)
            ->postJson("/api/v1/requests/{$reqOne}/cancel", ['reason' => 'Falta acometida eléctrica principal en predio.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        // Cancelación por cliente en in_progress
        $this->app['auth']->forgetGuards();
        $this->withToken($clientToken)
            ->postJson("/api/v1/requests/{$reqTwo}/cancel", ['reason' => 'Decidí suspender la reparación en curso.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');
    }

    // -------------------------------------------------------------------------
    // TRANSICIONES PROHIBIDAS (todas 409 sin mutar estado ni eventos)
    // -------------------------------------------------------------------------

    public function test_prohibited_transitions_return_409_and_do_not_mutate_state(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $clientToken = $client->createToken('client')->plainTextToken;
        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        // 1. pending -> in_progress, pending -> completed, y técnico cancelando pending
        $pendingId = $this->createPendingRequestViaApi($client, $tech);
        $this->app['auth']->forgetGuards();

        $this->withToken($techToken)->postJson("/api/v1/requests/{$pendingId}/start")->assertStatus(409);
        $this->withToken($techToken)->postJson("/api/v1/requests/{$pendingId}/complete")->assertStatus(409);
        $this->withToken($techToken)->postJson("/api/v1/requests/{$pendingId}/cancel", ['reason' => 'Motivo técnico'])->assertStatus(409);
        $this->assertSame(ServiceRequestStatus::Pending, ServiceRequest::query()->findOrFail($pendingId)->status);
        $this->assertSame(1, RequestEvent::query()->where('service_request_id', $pendingId)->count());

        // 2. accepted -> completed, y repetir accept dos veces
        $this->withToken($techToken)->postJson("/api/v1/requests/{$pendingId}/accept")->assertOk();
        $this->withToken($techToken)->postJson("/api/v1/requests/{$pendingId}/accept")->assertStatus(409);
        $this->withToken($techToken)->postJson("/api/v1/requests/{$pendingId}/complete")->assertStatus(409);
        $this->assertSame(ServiceRequestStatus::Accepted, ServiceRequest::query()->findOrFail($pendingId)->status);

        // 3. in_progress -> accepted, y repetir start dos veces
        $this->setLocalTestNow('2026-11-19 10:00:00');
        $this->withToken($techToken)->postJson("/api/v1/requests/{$pendingId}/start")->assertOk();
        $this->withToken($techToken)->postJson("/api/v1/requests/{$pendingId}/start")->assertStatus(409);
        $this->withToken($techToken)->postJson("/api/v1/requests/{$pendingId}/accept")->assertStatus(409);

        // 4. Estado final: completed (y repetir complete dos veces)
        $this->withToken($techToken)->postJson("/api/v1/requests/{$pendingId}/complete")->assertOk();
        $this->assertAllTransitionsBlockedOnFinalState($pendingId, $clientToken, $techToken, ServiceRequestStatus::Completed);

        // 5. Estado final: rejected (y repetir reject dos veces)
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $rejectedId = $this->createPendingRequestViaApi($client, $tech);
        $this->app['auth']->forgetGuards();
        $this->withToken($techToken)->postJson("/api/v1/requests/{$rejectedId}/reject", ['reason' => 'No disponible'])->assertOk();
        $this->assertAllTransitionsBlockedOnFinalState($rejectedId, $clientToken, $techToken, ServiceRequestStatus::Rejected);

        // 6. Estado final: cancelled (y repetir cancel dos veces)
        $cancelledId = $this->createPendingRequestViaApi($client, $tech);
        $this->app['auth']->forgetGuards();
        $this->withToken($clientToken)->postJson("/api/v1/requests/{$cancelledId}/cancel")->assertOk();
        $this->assertAllTransitionsBlockedOnFinalState($cancelledId, $clientToken, $techToken, ServiceRequestStatus::Cancelled);

        // 7. Estado final: expired
        $expiredId = $this->createPendingRequestViaApi($client, $tech);
        $this->setLocalTestNow('2026-11-21 10:00:00');
        $this->artisan('fixora:expire-requests')->assertExitCode(0);
        $this->assertAllTransitionsBlockedOnFinalState($expiredId, $clientToken, $techToken, ServiceRequestStatus::Expired);
    }

    private function assertAllTransitionsBlockedOnFinalState(
        int $requestId,
        string $clientToken,
        string $techToken,
        ServiceRequestStatus $expectedStatus,
    ): void {
        $eventsBefore = RequestEvent::query()->where('service_request_id', $requestId)->count();

        $this->app['auth']->forgetGuards();
        $this->withToken($techToken)->postJson("/api/v1/requests/{$requestId}/accept")->assertStatus(409);
        $this->withToken($techToken)->postJson("/api/v1/requests/{$requestId}/reject", ['reason' => 'Motivo válido'])->assertStatus(409);
        $this->withToken($techToken)->postJson("/api/v1/requests/{$requestId}/start")->assertStatus(409);
        $this->withToken($techToken)->postJson("/api/v1/requests/{$requestId}/complete")->assertStatus(409);
        $this->withToken($techToken)->postJson("/api/v1/requests/{$requestId}/cancel", ['reason' => 'Motivo válido'])->assertStatus(409);

        $this->app['auth']->forgetGuards();
        $this->withToken($clientToken)->postJson("/api/v1/requests/{$requestId}/cancel", ['reason' => 'Motivo válido'])->assertStatus(409);

        $this->assertSame($expectedStatus, ServiceRequest::query()->findOrFail($requestId)->status);
        $this->assertSame($eventsBefore, RequestEvent::query()->where('service_request_id', $requestId)->count());
    }

    // -------------------------------------------------------------------------
    // REGLAS DE NEGOCIO Y AUTORIZACIÓN
    // -------------------------------------------------------------------------

    public function test_reject_without_reason_fails_with_422(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $reqId = $this->createPendingRequestViaApi($client, $tech);

        $this->app['auth']->forgetGuards();
        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        $this->withToken($techToken)
            ->postJson("/api/v1/requests/{$reqId}/reject", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['reason']);
    }

    public function test_cancel_in_accepted_or_in_progress_without_reason_fails_with_422(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $clientToken = $client->createToken('client')->plainTextToken;
        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        $reqId = $this->createPendingRequestViaApi($client, $tech);

        $this->app['auth']->forgetGuards();
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/accept")->assertOk();

        // Cancelar en accepted sin reason -> 422
        $this->app['auth']->forgetGuards();
        $this->withToken($clientToken)
            ->postJson("/api/v1/requests/{$reqId}/cancel", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['reason']);

        // Pasar a in_progress y cancelar sin reason -> 422
        $this->setLocalTestNow('2026-11-19 10:00:00');
        $this->app['auth']->forgetGuards();
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/start")->assertOk();

        $this->withToken($techToken)
            ->postJson("/api/v1/requests/{$reqId}/cancel", ['reason' => '   '])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['reason']);
    }

    public function test_start_before_preferred_date_fails_and_on_preferred_date_succeeds(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $reqId = $this->createPendingRequestViaApi($client, $tech);

        $this->app['auth']->forgetGuards();
        $techToken = $tech['user']->createToken('tech')->plainTextToken;
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/accept")->assertOk();

        // Un día antes de preferred_date (2026-11-18 < 2026-11-19) -> 422
        $this->withToken($techToken)
            ->postJson("/api/v1/requests/{$reqId}/start")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['preferred_date']);

        // En la fecha local programada (2026-11-19) -> 200
        $this->setLocalTestNow('2026-11-19 08:00:00');
        $this->withToken($techToken)
            ->postJson("/api/v1/requests/{$reqId}/start")
            ->assertOk()
            ->assertJsonPath('data.status', 'in_progress');
    }

    public function test_accept_with_schedule_collision_returns_409(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $clientA = $this->createClient('Cliente A', 'ca@fixora.test');
        $clientB = $this->createClient('Cliente B', 'cb@fixora.test');

        $reqA = $this->createPendingRequestViaApi($clientA, $tech, ['preferred_date' => '2026-11-19', 'preferred_start' => '10:00']);
        $reqB = $this->createPendingRequestViaApi($clientB, $tech, ['preferred_date' => '2026-11-19', 'preferred_start' => '10:00']);

        $this->app['auth']->forgetGuards();
        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqA}/accept")->assertOk();
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqB}/accept")->assertStatus(409);

        $this->assertSame(ServiceRequestStatus::Pending, ServiceRequest::query()->findOrFail($reqB)->status);
    }

    public function test_completed_increments_completed_count_by_exactly_one(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $reqId = $this->createPendingRequestViaApi($client, $tech);

        $this->assertSame(0, (int) $tech['profile']->fresh()->completed_count);

        $this->app['auth']->forgetGuards();
        $techToken = $tech['user']->createToken('tech')->plainTextToken;
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/accept")->assertOk();

        $this->setLocalTestNow('2026-11-19 10:00:00');
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/start")->assertOk();
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/complete")->assertOk();

        $this->assertSame(1, (int) $tech['profile']->fresh()->completed_count);
    }

    public function test_client_cannot_accept_start_or_complete_returns_403(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $clientToken = $client->createToken('client')->plainTextToken;

        $reqId = (int) $this->withToken($clientToken)
            ->postJson('/api/v1/requests', $this->validPayload($tech['profile'], $tech['specialty']->id))
            ->assertStatus(201)
            ->json('data.id');

        $this->withToken($clientToken)->postJson("/api/v1/requests/{$reqId}/accept")->assertStatus(403);
        $this->withToken($clientToken)->postJson("/api/v1/requests/{$reqId}/start")->assertStatus(403);
        $this->withToken($clientToken)->postJson("/api/v1/requests/{$reqId}/complete")->assertStatus(403);
    }

    public function test_technician_cannot_create_or_cancel_another_technicians_request(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $techA = $this->createReadyTechnician('Tech A', 'techa@fixora.test');
        $techB = $this->createReadyTechnician('Tech B', 'techb@fixora.test');
        $client = $this->createClient();
        $reqId = $this->createPendingRequestViaApi($client, $techA);

        $this->app['auth']->forgetGuards();
        $techBToken = $techB['user']->createToken('tech-b')->plainTextToken;

        $this->withToken($techBToken)
            ->postJson('/api/v1/requests', $this->validPayload($techA['profile'], $techA['specialty']->id))
            ->assertStatus(403);

        // Usuario ajeno (techB) recibe 404 al intentar cancelar solicitud de techA
        $this->withToken($techBToken)
            ->postJson("/api/v1/requests/{$reqId}/cancel", ['reason' => 'No me pertenece'])
            ->assertStatus(404);
    }

    public function test_unrelated_user_receives_404_on_detail_and_every_action(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $ownerClient = $this->createClient('Dueño', 'owner@fixora.test');
        $intruderClient = $this->createClient('Intruso', 'intruder@fixora.test');
        $reqId = $this->createPendingRequestViaApi($ownerClient, $tech);

        $this->app['auth']->forgetGuards();
        $intruderToken = $intruderClient->createToken('intruder')->plainTextToken;

        $this->withToken($intruderToken)->getJson("/api/v1/requests/{$reqId}")->assertStatus(404);
        $this->withToken($intruderToken)->postJson("/api/v1/requests/{$reqId}/accept")->assertStatus(404);
        $this->withToken($intruderToken)->postJson("/api/v1/requests/{$reqId}/reject", ['reason' => 'Intrusión'])->assertStatus(404);
        $this->withToken($intruderToken)->postJson("/api/v1/requests/{$reqId}/start")->assertStatus(404);
        $this->withToken($intruderToken)->postJson("/api/v1/requests/{$reqId}/complete")->assertStatus(404);
        $this->withToken($intruderToken)->postJson("/api/v1/requests/{$reqId}/cancel", ['reason' => 'Intrusión'])->assertStatus(404);
    }

    public function test_each_transition_records_exactly_one_event_with_correct_actor(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $reqId = $this->createPendingRequestViaApi($client, $tech);

        $this->app['auth']->forgetGuards();
        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/accept")->assertOk();

        $this->setLocalTestNow('2026-11-19 10:00:00');
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/start")->assertOk();
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/complete")->assertOk();

        $events = RequestEvent::query()
            ->where('service_request_id', $reqId)
            ->orderBy('id')
            ->get();

        $this->assertCount(4, $events);

        $this->assertSame(
            [null, 'pending', $client->id, 'client'],
            [$events[0]->from_status?->value, $events[0]->to_status->value, $events[0]->actor_id, $events[0]->actor_role->value]
        );
        $this->assertSame(
            ['pending', 'accepted', $tech['user']->id, 'technician'],
            [$events[1]->from_status?->value, $events[1]->to_status->value, $events[1]->actor_id, $events[1]->actor_role->value]
        );
        $this->assertSame(
            ['accepted', 'in_progress', $tech['user']->id, 'technician'],
            [$events[2]->from_status?->value, $events[2]->to_status->value, $events[2]->actor_id, $events[2]->actor_role->value]
        );
        $this->assertSame(
            ['in_progress', 'completed', $tech['user']->id, 'technician'],
            [$events[3]->from_status?->value, $events[3]->to_status->value, $events[3]->actor_id, $events[3]->actor_role->value]
        );
    }

    // -------------------------------------------------------------------------
    // PRIVACIDAD (RN-09) Y AVAILABLE_ACTIONS
    // -------------------------------------------------------------------------

    public function test_privacy_hides_address_coordinates_and_phone_in_non_confirmed_states_and_never_exposes_email(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician(email: 'secreto.tech@fixora.test', phone: '9389990001');
        $client = $this->createClient(email: 'secreto.client@fixora.test', phone: '9389990002');
        $clientToken = $client->createToken('client')->plainTextToken;
        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        // 1. pending
        $pendingId = $this->createPendingRequestViaApi($client, $tech);
        $this->assertSensitiveHidden($pendingId, $clientToken, 'secreto.tech@fixora.test');
        $this->assertSensitiveHidden($pendingId, $techToken, 'secreto.client@fixora.test');

        // 2. rejected
        $rejectedId = $this->createPendingRequestViaApi($client, $tech, ['preferred_date' => '2026-11-20']);
        $this->app['auth']->forgetGuards();
        $this->withToken($techToken)->postJson("/api/v1/requests/{$rejectedId}/reject", ['reason' => 'No disponible'])->assertOk();
        $this->assertSensitiveHidden($rejectedId, $clientToken, 'secreto.tech@fixora.test');
        $this->assertSensitiveHidden($rejectedId, $techToken, 'secreto.client@fixora.test');

        // 3. cancelled
        $cancelledId = $this->createPendingRequestViaApi($client, $tech, ['preferred_date' => '2026-11-23']);
        $this->app['auth']->forgetGuards();
        $this->withToken($clientToken)->postJson("/api/v1/requests/{$cancelledId}/cancel")->assertOk();
        $this->assertSensitiveHidden($cancelledId, $clientToken, 'secreto.tech@fixora.test');
        $this->assertSensitiveHidden($cancelledId, $techToken, 'secreto.client@fixora.test');

        // 4. expired
        $expiredId = $this->createPendingRequestViaApi($client, $tech, ['preferred_date' => '2026-11-24']);
        $this->setLocalTestNow('2026-11-21 10:00:00');
        $this->artisan('fixora:expire-requests')->assertExitCode(0);
        $this->assertSensitiveHidden($expiredId, $clientToken, 'secreto.tech@fixora.test');
        $this->assertSensitiveHidden($expiredId, $techToken, 'secreto.client@fixora.test');
    }

    public function test_privacy_reveals_address_coordinates_and_phone_in_accepted_in_progress_and_completed(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician(email: 'secreto.tech@fixora.test', phone: '9389990001');
        $client = $this->createClient(email: 'secreto.client@fixora.test', phone: '9389990002');
        $clientToken = $client->createToken('client')->plainTextToken;
        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        $reqId = $this->createPendingRequestViaApi($client, $tech);

        // accepted
        $this->app['auth']->forgetGuards();
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/accept")->assertOk();
        $this->assertSensitiveVisible($reqId, $clientToken, $techToken, 'secreto.tech@fixora.test', 'secreto.client@fixora.test');

        // in_progress
        $this->setLocalTestNow('2026-11-19 10:00:00');
        $this->app['auth']->forgetGuards();
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/start")->assertOk();
        $this->assertSensitiveVisible($reqId, $clientToken, $techToken, 'secreto.tech@fixora.test', 'secreto.client@fixora.test');

        // completed
        $this->app['auth']->forgetGuards();
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/complete")->assertOk();
        $this->assertSensitiveVisible($reqId, $clientToken, $techToken, 'secreto.tech@fixora.test', 'secreto.client@fixora.test');
    }

    public function test_available_actions_match_allowed_actions_by_role_and_status(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $clientToken = $client->createToken('client')->plainTextToken;
        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        $reqId = $this->createPendingRequestViaApi($client, $tech);

        // pending: cliente ['cancel'], técnico ['accept', 'reject']
        $this->app['auth']->forgetGuards();
        $this->withToken($clientToken)->getJson("/api/v1/requests/{$reqId}")
            ->assertJsonPath('data.available_actions', ['cancel']);

        $this->app['auth']->forgetGuards();
        $this->withToken($techToken)->getJson("/api/v1/requests/{$reqId}")
            ->assertJsonPath('data.available_actions', ['accept', 'reject']);

        // accepted: cliente ['cancel'], técnico ['start', 'cancel']
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/accept")->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($clientToken)->getJson("/api/v1/requests/{$reqId}")
            ->assertJsonPath('data.available_actions', ['cancel']);

        $this->app['auth']->forgetGuards();
        $this->withToken($techToken)->getJson("/api/v1/requests/{$reqId}")
            ->assertJsonPath('data.available_actions', ['start', 'cancel']);

        // in_progress: cliente ['cancel'], técnico ['complete', 'cancel']
        $this->setLocalTestNow('2026-11-19 10:00:00');
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/start")->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($clientToken)->getJson("/api/v1/requests/{$reqId}")
            ->assertJsonPath('data.available_actions', ['cancel']);

        $this->app['auth']->forgetGuards();
        $this->withToken($techToken)->getJson("/api/v1/requests/{$reqId}")
            ->assertJsonPath('data.available_actions', ['complete', 'cancel']);

        // completed: ambos []
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/complete")->assertOk()
            ->assertJsonPath('data.available_actions', []);

        $this->app['auth']->forgetGuards();
        $this->withToken($clientToken)->getJson("/api/v1/requests/{$reqId}")
            ->assertJsonPath('data.available_actions', []);
    }

    // -------------------------------------------------------------------------
    // LISTADO, FILTROS, PAGINACIÓN Y ORDEN
    // -------------------------------------------------------------------------

    public function test_listing_filters_by_owner_status_pagination_and_descending_order(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $techA = $this->createReadyTechnician('Tech A', 'techa@fixora.test', weekdays: [1, 2, 3, 4, 5, 6, 7]);
        $techB = $this->createReadyTechnician('Tech B', 'techb@fixora.test', weekdays: [1, 2, 3, 4, 5, 6, 7]);

        $clientA = $this->createClient('Client A', 'clienta@fixora.test');
        $clientB = $this->createClient('Client B', 'clientb@fixora.test');

        $r1 = $this->createPendingRequestViaApi($clientA, $techA, ['preferred_date' => '2026-11-19']);
        $this->setLocalTestNow('2026-11-18 10:05:00');
        $r2 = $this->createPendingRequestViaApi($clientA, $techA, ['preferred_date' => '2026-11-20']);
        $this->setLocalTestNow('2026-11-18 10:10:00');
        $r3 = $this->createPendingRequestViaApi($clientB, $techB, ['preferred_date' => '2026-11-21']);

        $this->app['auth']->forgetGuards();
        $techAToken = $techA['user']->createToken('tech-a')->plainTextToken;
        $this->withToken($techAToken)->postJson("/api/v1/requests/{$r1}/accept")->assertOk();

        // Cliente A solo ve r2 y r1 en orden descendente
        $this->app['auth']->forgetGuards();
        $clientAToken = $clientA->createToken('client-a')->plainTextToken;

        $this->withToken($clientAToken)->getJson('/api/v1/requests')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $r2)
            ->assertJsonPath('data.1.id', $r1);

        // Técnico A solo ve las suyas (r2 y r1)
        $this->app['auth']->forgetGuards();
        $this->withToken($techAToken)->getJson('/api/v1/requests')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $r2);

        // Filtro por un estado
        $this->withToken($techAToken)->getJson('/api/v1/requests?status=accepted')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $r1);

        // Filtro por varios estados separados por coma
        $this->withToken($techAToken)->getJson('/api/v1/requests?status=pending,accepted')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        // Paginación (per_page=1)
        $this->withToken($techAToken)->getJson('/api/v1/requests?per_page=1&page=2')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $r1)
            ->assertJsonPath('meta.total', 2);
    }

    // -------------------------------------------------------------------------
    // VENCIMIENTO AUTOMÁTICO (fixora:expire-requests)
    // -------------------------------------------------------------------------

    public function test_expire_command_expires_only_due_pending_requests_and_is_idempotent(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician(weekdays: [1, 2, 3, 4, 5, 6, 7]);
        $client = $this->createClient();

        // Solicitud 1: creada a las 10:00 (vence 2026-11-20 10:00)
        $dueReq = $this->createPendingRequestViaApi($client, $tech, ['preferred_date' => '2026-11-21']);

        // Solicitud 2: creada a las 10:00 y aceptada (no debe expirar)
        $acceptedReq = $this->createPendingRequestViaApi($client, $tech, ['preferred_date' => '2026-11-22']);
        $this->app['auth']->forgetGuards();
        $techToken = $tech['user']->createToken('tech')->plainTextToken;
        $this->withToken($techToken)->postJson("/api/v1/requests/{$acceptedReq}/accept")->assertOk();

        // Solicitud 3: creada 10 horas después (vence 2026-11-20 20:00, aún vigente a las 12:00)
        $this->setLocalTestNow('2026-11-18 20:00:00');
        $activeReq = $this->createPendingRequestViaApi($client, $tech, ['preferred_date' => '2026-11-23']);

        // Ejecutar comando el 2026-11-20 a las 12:00
        $this->setLocalTestNow('2026-11-20 12:00:00');
        $this->artisan('fixora:expire-requests')->assertExitCode(0);

        $this->assertSame(ServiceRequestStatus::Expired, ServiceRequest::query()->findOrFail($dueReq)->status);
        $this->assertSame(ServiceRequestStatus::Accepted, ServiceRequest::query()->findOrFail($acceptedReq)->status);
        $this->assertSame(ServiceRequestStatus::Pending, ServiceRequest::query()->findOrFail($activeReq)->status);

        $this->assertDatabaseHas('request_events', [
            'service_request_id' => $dueReq,
            'from_status' => 'pending',
            'to_status' => 'expired',
            'actor_id' => null,
            'actor_role' => 'system',
        ]);

        // Correrlo por segunda vez es idempotente y no duplica eventos
        $this->artisan('fixora:expire-requests')->assertExitCode(0);
        $this->assertSame(
            1,
            RequestEvent::query()->where('service_request_id', $dueReq)->where('to_status', 'expired')->count()
        );
    }

    // -------------------------------------------------------------------------
    // ATOMICIDAD TRANSACCIONAL
    // -------------------------------------------------------------------------

    public function test_atomicity_rolls_back_status_and_counters_if_event_insertion_fails(): void
    {
        $this->setLocalTestNow('2026-11-18 10:00:00');
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $reqId = $this->createPendingRequestViaApi($client, $tech);

        $this->app['auth']->forgetGuards();
        $techToken = $tech['user']->createToken('tech')->plainTextToken;
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/accept")->assertOk();

        $this->setLocalTestNow('2026-11-19 10:00:00');
        $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/start")->assertOk();

        $eventsBefore = RequestEvent::query()->where('service_request_id', $reqId)->count();

        // Simular fallo al insertar el evento de completado
        RequestEvent::creating(static function (): void {
            throw new RuntimeException('Fallo simulado al insertar request_event');
        });

        try {
            $this->withoutExceptionHandling();
            $this->expectException(RuntimeException::class);
            $this->withToken($techToken)->postJson("/api/v1/requests/{$reqId}/complete");
        } finally {
            RequestEvent::flushEventListeners();
        }

        $freshRequest = ServiceRequest::query()->findOrFail($reqId);
        $this->assertSame(ServiceRequestStatus::InProgress, $freshRequest->status);
        $this->assertNull($freshRequest->completed_at);
        $this->assertSame(0, (int) $tech['profile']->fresh()->completed_count);
        $this->assertSame($eventsBefore, RequestEvent::query()->where('service_request_id', $reqId)->count());
    }

    // -------------------------------------------------------------------------
    // HELPERS
    // -------------------------------------------------------------------------

    /**
     * @param array{user: User, profile: TechnicianProfile, specialty: Specialty, service: TechnicianService} $tech
     * @param array<string, mixed> $overrides
     */
    private function createPendingRequestViaApi(User $client, array $tech, array $overrides = []): int
    {
        $this->app['auth']->forgetGuards();
        $token = $client->createToken('helper-' . uniqid('', true))->plainTextToken;

        return (int) $this->withToken($token)
            ->postJson('/api/v1/requests', $this->validPayload($tech['profile'], $tech['specialty']->id, $tech['service']->id, $overrides))
            ->assertStatus(201)
            ->json('data.id');
    }

    private function assertSensitiveHidden(int $requestId, string $token, string $counterpartEmail): void
    {
        $this->app['auth']->forgetGuards();
        $response = $this->withToken($token)->getJson("/api/v1/requests/{$requestId}")
            ->assertOk()
            ->assertJsonMissingPath('data.address_line')
            ->assertJsonMissingPath('data.latitude')
            ->assertJsonMissingPath('data.longitude')
            ->assertJsonMissingPath('data.client.phone')
            ->assertJsonMissingPath('data.technician.phone');

        $this->assertStringNotContainsString($counterpartEmail, (string) $response->getContent());
    }

    private function assertSensitiveVisible(
        int $requestId,
        string $clientToken,
        string $techToken,
        string $techEmail,
        string $clientEmail,
    ): void {
        $this->app['auth']->forgetGuards();
        $clientView = $this->withToken($clientToken)->getJson("/api/v1/requests/{$requestId}")
            ->assertOk()
            ->assertJsonPath('data.address_line', 'Calle 56 #124, Col. Petrolera, Ciudad del Carmen')
            ->assertJsonPath('data.latitude', 18.6451234)
            ->assertJsonPath('data.longitude', -91.8219876)
            ->assertJsonPath('data.technician.phone', '9389990001');

        $this->assertStringNotContainsString($techEmail, (string) $clientView->getContent());

        $this->app['auth']->forgetGuards();
        $techView = $this->withToken($techToken)->getJson("/api/v1/requests/{$requestId}")
            ->assertOk()
            ->assertJsonPath('data.address_line', 'Calle 56 #124, Col. Petrolera, Ciudad del Carmen')
            ->assertJsonPath('data.latitude', 18.6451234)
            ->assertJsonPath('data.longitude', -91.8219876)
            ->assertJsonPath('data.client.phone', '9389990002');

        $this->assertStringNotContainsString($clientEmail, (string) $techView->getContent());
    }
}