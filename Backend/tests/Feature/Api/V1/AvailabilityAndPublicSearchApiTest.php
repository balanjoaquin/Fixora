<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AvailabilitySlot;
use App\Models\Specialty;
use App\Models\TechnicianProfile;
use App\Models\TechnicianService;
use App\Models\User;
use App\Services\ProfileVisibilityService;
use Database\Seeders\SpecialtySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AvailabilityAndPublicSearchApiTest extends TestCase
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
     * @param array<string, mixed> $userOverrides
     * @param array<string, mixed> $profileOverrides
     * @param array<int, int> $specialtyIds
     * @param array<int, array{weekday: int, start_time: string, end_time: string}> $slots
     */
    private function createTechnician(
        array $userOverrides = [],
        array $profileOverrides = [],
        array $specialtyIds = [],
        array $slots = [],
        bool $recalculateVisibility = true,
    ): TechnicianProfile {
        /** @var User $user */
        $user = User::factory()->create(array_merge([
            'role' => UserRole::Technician,
            'status' => UserStatus::Active,
            'phone' => '9381112233',
        ], $userOverrides));

        /** @var TechnicianProfile $profile */
        $profile = TechnicianProfile::factory()->create(array_merge([
            'user_id' => $user->id,
            'headline' => 'Técnico certificado en Ciudad del Carmen',
            'bio' => 'Atención residencial y comercial con garantía.',
            'years_experience' => 5,
            'service_zone' => 'Playa Norte, Ciudad del Carmen',
            'latitude' => 18.6530000,
            'longitude' => -91.8340000,
            'service_radius_km' => 10,
            'is_visible' => false,
            'rating_avg' => 4.80,
            'rating_count' => 12,
            'completed_count' => 15,
            'verified_at' => now(),
        ], $profileOverrides));

        if ($specialtyIds !== []) {
            $profile->specialties()->sync($specialtyIds);
        }

        foreach ($slots as $slot) {
            AvailabilitySlot::factory()->create([
                'technician_profile_id' => $profile->id,
                'weekday' => $slot['weekday'],
                'start_time' => $slot['start_time'],
                'end_time' => $slot['end_time'],
            ]);
        }

        if ($recalculateVisibility) {
            app(ProfileVisibilityService::class)->recalculate($profile);
        }

        return $profile->fresh(['user', 'specialties', 'availabilitySlots']);
    }

    public function test_valid_availability_replacement_updates_slots_and_recalculates_visibility(): void
    {
        $specialty = Specialty::query()->firstOrFail();
        $profile = $this->createTechnician(
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 7, 'start_time' => '10:00', 'end_time' => '12:00']],
        );

        $token = $profile->user->createToken('tech')->plainTextToken;

        $response = $this->withToken($token)->putJson('/api/v1/technician/availability', [
            'slots' => [
                ['weekday' => 3, 'start_time' => '14:00', 'end_time' => '18:00'],
                ['weekday' => 1, 'start_time' => '08:30', 'end_time' => '12:30'],
            ],
        ]);

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.weekday', 1)
            ->assertJsonPath('data.0.start_time', '08:30')
            ->assertJsonPath('data.0.end_time', '12:30')
            ->assertJsonPath('data.1.weekday', 3);

        $this->assertDatabaseMissing('availability_slots', [
            'technician_profile_id' => $profile->id,
            'weekday' => 7,
        ]);

        $this->withToken($token)->getJson('/api/v1/technician/availability')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.weekday', 1);

        $this->assertTrue($profile->fresh()->is_visible);
    }

    public function test_overlapping_slots_are_rejected(): void
    {
        $profile = $this->createTechnician();
        $token = $profile->user->createToken('tech')->plainTextToken;

        $this->withToken($token)->putJson('/api/v1/technician/availability', [
            'slots' => [
                ['weekday' => 2, 'start_time' => '09:00', 'end_time' => '13:00'],
                ['weekday' => 2, 'start_time' => '12:30', 'end_time' => '16:00'],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['slots.1.start_time']);
    }

    public function test_end_time_less_than_or_equal_to_start_time_or_under_30_minutes_is_rejected(): void
    {
        $profile = $this->createTechnician();
        $token = $profile->user->createToken('tech')->plainTextToken;

        $this->withToken($token)->putJson('/api/v1/technician/availability', [
            'slots' => [
                ['weekday' => 1, 'start_time' => '13:00', 'end_time' => '13:00'],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['slots.0.end_time']);

        $this->withToken($token)->putJson('/api/v1/technician/availability', [
            'slots' => [
                ['weekday' => 1, 'start_time' => '14:00', 'end_time' => '13:00'],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['slots.0.end_time']);

        $this->withToken($token)->putJson('/api/v1/technician/availability', [
            'slots' => [
                ['weekday' => 1, 'start_time' => '09:00', 'end_time' => '09:29'],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['slots.0.end_time']);
    }

    public function test_more_than_five_slots_per_day_is_rejected(): void
    {
        $profile = $this->createTechnician();
        $token = $profile->user->createToken('tech')->plainTextToken;

        $this->withToken($token)->putJson('/api/v1/technician/availability', [
            'slots' => [
                ['weekday' => 4, 'start_time' => '08:00', 'end_time' => '08:30'],
                ['weekday' => 4, 'start_time' => '09:00', 'end_time' => '09:30'],
                ['weekday' => 4, 'start_time' => '10:00', 'end_time' => '10:30'],
                ['weekday' => 4, 'start_time' => '11:00', 'end_time' => '11:30'],
                ['weekday' => 4, 'start_time' => '12:00', 'end_time' => '12:30'],
                ['weekday' => 4, 'start_time' => '13:00', 'end_time' => '13:30'],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['slots']);
    }

    public function test_contiguous_slots_on_same_day_are_accepted(): void
    {
        $profile = $this->createTechnician();
        $token = $profile->user->createToken('tech')->plainTextToken;

        $this->withToken($token)->putJson('/api/v1/technician/availability', [
            'slots' => [
                ['weekday' => 5, 'start_time' => '09:00', 'end_time' => '13:00'],
                ['weekday' => 5, 'start_time' => '13:00', 'end_time' => '17:00'],
            ],
        ])->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_empty_slots_list_clears_availability_and_sets_is_visible_to_zero(): void
    {
        $specialty = Specialty::query()->firstOrFail();
        $profile = $this->createTechnician(
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );
        $this->assertTrue($profile->is_visible);

        $token = $profile->user->createToken('tech')->plainTextToken;

        $this->withToken($token)->putJson('/api/v1/technician/availability', [
            'slots' => [],
        ])->assertOk()
            ->assertJsonCount(0, 'data');

        $this->assertFalse($profile->fresh()->is_visible);
    }

    public function test_technician_cannot_modify_another_technicians_availability_and_client_receives_403(): void
    {
        $techA = $this->createTechnician(
            slots: [['weekday' => 1, 'start_time' => '08:00', 'end_time' => '12:00']],
        );
        $techB = $this->createTechnician(
            slots: [['weekday' => 2, 'start_time' => '14:00', 'end_time' => '18:00']],
        );

        $tokenA = $techA->user->createToken('tech-a')->plainTextToken;

        $this->withToken($tokenA)->putJson('/api/v1/technician/availability', [
            'slots' => [
                ['weekday' => 3, 'start_time' => '10:00', 'end_time' => '12:00'],
            ],
        ])->assertOk();

        // La disponibilidad del técnico B permanece intacta
        $this->assertDatabaseHas('availability_slots', [
            'technician_profile_id' => $techB->id,
            'weekday' => 2,
        ]);
        $this->assertDatabaseMissing('availability_slots', [
            'technician_profile_id' => $techB->id,
            'weekday' => 3,
        ]);

        // Limpia la caché del guard de Sanctum antes de autenticar otro token en el mismo test
        $this->app['auth']->forgetGuards();

        /** @var User $client */
        $client = User::factory()->create([
            'role' => UserRole::Client,
            'status' => UserStatus::Active,
        ]);
        $clientToken = $client->createToken('client')->plainTextToken;

        $this->withToken($clientToken)
            ->getJson('/api/v1/technician/availability')
            ->assertStatus(403);

        $this->withToken($clientToken)
            ->putJson('/api/v1/technician/availability', ['slots' => []])
            ->assertStatus(403);
    }

    public function test_search_without_filters_returns_only_visible_and_active_technicians(): void
    {
        $specialty = Specialty::query()->firstOrFail();

        $visibleActive = $this->createTechnician(
            userOverrides: ['name' => 'Carlos Méndez'],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );

        // Técnico sin disponibilidad -> is_visible = false
        $this->createTechnician(
            userOverrides: ['name' => 'Técnico Oculto'],
            specialtyIds: [$specialty->id],
            slots: [],
        );

        $response = $this->getJson('/api/v1/technicians');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visibleActive->id)
            ->assertJsonPath('data.0.name', 'Carlos Méndez');
    }

    public function test_suspended_technician_does_not_appear_in_search(): void
    {
        $specialty = Specialty::query()->firstOrFail();

        $suspended = $this->createTechnician(
            userOverrides: ['status' => UserStatus::Suspended],
            profileOverrides: ['is_visible' => true],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
            recalculateVisibility: false,
        );

        $this->getJson('/api/v1/technicians')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->assertNotNull($suspended->id);
    }

    public function test_non_visible_technician_does_not_appear_in_search(): void
    {
        $specialty = Specialty::query()->firstOrFail();

        $this->createTechnician(
            profileOverrides: ['is_visible' => false],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
            recalculateVisibility: false,
        );

        $this->getJson('/api/v1/technicians')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_filter_by_specialty_id_and_slug(): void
    {
        $specialties = Specialty::query()->orderBy('id')->take(2)->get();
        $first = $specialties[0];
        $second = $specialties[1];

        $techOne = $this->createTechnician(
            specialtyIds: [$first->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );
        $techTwo = $this->createTechnician(
            specialtyIds: [$second->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );

        $this->getJson("/api/v1/technicians?specialty_id={$first->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $techOne->id);

        $this->getJson("/api/v1/technicians?specialty={$second->slug}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $techTwo->id);
    }

    public function test_filter_q_searches_service_headline_and_two_character_terms(): void
    {
        $specialty = Specialty::query()->firstOrFail();

        $techByHeadline = $this->createTechnician(
            profileOverrides: ['headline' => 'Especialista en minisplit inverter'],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );

        $techByService = $this->createTechnician(
            profileOverrides: ['headline' => 'Mantenimiento residencial general'],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );
        TechnicianService::factory()->create([
            'technician_profile_id' => $techByService->id,
            'specialty_id' => $specialty->id,
            'title' => 'Reparación de tablero trifásico',
            'description' => 'Diagnóstico de cortocircuitos en hogar y comercio',
            'is_active' => true,
        ]);

        // Servicio inactivo no debe coincidir
        $techInactiveService = $this->createTechnician(
            profileOverrides: ['headline' => 'Otro perfil técnico'],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );
        TechnicianService::factory()->create([
            'technician_profile_id' => $techInactiveService->id,
            'specialty_id' => $specialty->id,
            'title' => 'Reparación de tablero trifásico',
            'is_active' => false,
        ]);

        // Búsqueda >= 3 caracteres por headline
        $this->getJson('/api/v1/technicians?q=minisplit')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $techByHeadline->id);

        // Búsqueda >= 3 caracteres por servicio activo
        $this->getJson('/api/v1/technicians?q=trifásico')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $techByService->id);

        // Búsqueda exacta de 2 caracteres (LIKE)
        $this->getJson('/api/v1/technicians?q=TV')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $techTwoChars = $this->createTechnician(
            profileOverrides: ['headline' => 'Soporte de pantallas TV y equipos de audio'],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );

        $this->getJson('/api/v1/technicians?q=TV')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $techTwoChars->id);
    }

    public function test_q_with_percent_and_underscore_does_not_act_as_wildcard(): void
    {
        $specialty = Specialty::query()->firstOrFail();

        $this->createTechnician(
            profileOverrides: ['headline' => 'Servicio general garantizado'],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );

        $this->getJson('/api/v1/technicians?q=' . urlencode('%%%'))
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->getJson('/api/v1/technicians?q=' . urlencode('___'))
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->getJson('/api/v1/technicians?q=' . urlencode('__'))
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_filter_by_zone_escapes_wildcards_and_matches_service_zone(): void
    {
        $specialty = Specialty::query()->firstOrFail();

        $playaNorte = $this->createTechnician(
            profileOverrides: ['service_zone' => 'Playa Norte, Ciudad del Carmen'],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );

        $this->createTechnician(
            profileOverrides: ['service_zone' => 'Colonia Petrolera, Ciudad del Carmen'],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );

        $this->getJson('/api/v1/technicians?zone=' . urlencode('Playa Norte'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $playaNorte->id);

        $this->getJson('/api/v1/technicians?zone=' . urlencode('%%%'))
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_proximity_search_includes_within_radius_and_excludes_outside_with_verified_distance(): void
    {
        $specialty = Specialty::query()->firstOrFail();

        // Punto de referencia en Ciudad del Carmen (Centro / Malecón)
        $originLat = 18.6414;
        $originLng = -91.8323;

        // Técnico cercano (~2.1 km al noreste, Playa Norte) con radio de cobertura 5 km
        $nearTech = $this->createTechnician(
            profileOverrides: [
                'latitude' => 18.6580,
                'longitude' => -91.8220,
                'service_radius_km' => 5,
            ],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );

        // Técnico dentro del radio de búsqueda (10 km), ~6.5 km al este (aeropuerto / isla), fuera de su propio radio de 3 km
        $midTech = $this->createTechnician(
            profileOverrides: [
                'latitude' => 18.6500,
                'longitude' => -91.7710,
                'service_radius_km' => 3,
            ],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );

        // Técnico fuera del radio de 10 km (~18 km al este, Isla Aguada / carretera)
        $this->createTechnician(
            profileOverrides: [
                'latitude' => 18.6800,
                'longitude' => -91.6650,
                'service_radius_km' => 20,
            ],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );

        $expectedNearKm = round($this->haversineKm($originLat, $originLng, 18.6580, -91.8220), 1);
        $expectedMidKm = round($this->haversineKm($originLat, $originLng, 18.6500, -91.7710), 1);

        $response = $this->getJson("/api/v1/technicians?lat={$originLat}&lng={$originLng}&radius_km=10");

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $nearTech->id)
            ->assertJsonPath('data.0.within_service_radius', true)
            ->assertJsonPath('data.1.id', $midTech->id)
            ->assertJsonPath('data.1.within_service_radius', false);

        $this->assertEqualsWithDelta($expectedNearKm, (float) $response->json('data.0.distance_km'), 0.2);
        $this->assertEqualsWithDelta($expectedMidKm, (float) $response->json('data.1.distance_km'), 0.2);
    }

    public function test_sort_by_distance_orders_ascending(): void
    {
        $specialty = Specialty::query()->firstOrFail();

        $farther = $this->createTechnician(
            profileOverrides: [
                'latitude' => 18.6700,
                'longitude' => -91.8000,
                'rating_avg' => 5.00,
            ],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );

        $closer = $this->createTechnician(
            profileOverrides: [
                'latitude' => 18.6430,
                'longitude' => -91.8310,
                'rating_avg' => 3.50,
            ],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );

        $this->getJson('/api/v1/technicians?lat=18.6414&lng=-91.8323&radius_km=15&sort=distance')
            ->assertOk()
            ->assertJsonPath('data.0.id', $closer->id)
            ->assertJsonPath('data.1.id', $farther->id);
    }

    public function test_sort_distance_without_coordinates_returns_422(): void
    {
        $this->getJson('/api/v1/technicians?sort=distance')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['sort']);
    }

    public function test_lat_without_lng_returns_422(): void
    {
        $this->getJson('/api/v1/technicians?lat=18.6414')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['lng']);

        $this->getJson('/api/v1/technicians?lng=-91.8323')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['lat']);
    }

    public function test_radius_out_of_range_returns_422(): void
    {
        $this->getJson('/api/v1/technicians?lat=18.6414&lng=-91.8323&radius_km=0')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['radius_km']);

        $this->getJson('/api/v1/technicians?lat=18.6414&lng=-91.8323&radius_km=101')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['radius_km']);
    }

    public function test_available_on_maps_day_of_week_correctly(): void
    {
        // Fijamos miércoles 2026-11-18 (dayOfWeekIso = 3)
        Carbon::setTestNow(Carbon::create(2026, 11, 18, 9, 0, 0));

        $specialty = Specialty::query()->firstOrFail();

        // Jueves 2026-11-19 -> dayOfWeekIso = 4
        $thursdayTech = $this->createTechnician(
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 4, 'start_time' => '09:00', 'end_time' => '14:00']],
        );

        // Viernes 2026-11-20 -> dayOfWeekIso = 5
        $this->createTechnician(
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 5, 'start_time' => '09:00', 'end_time' => '14:00']],
        );

        $this->getJson('/api/v1/technicians?available_on=2026-11-19')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $thursdayTech->id);
    }

    public function test_available_on_and_available_at_respects_inclusive_start_and_exclusive_end(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 11, 18, 8, 0, 0));

        $specialty = Specialty::query()->firstOrFail();

        // Jueves 2026-11-19 (weekday = 4), franja 09:00 - 13:00
        $tech = $this->createTechnician(
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 4, 'start_time' => '09:00', 'end_time' => '13:00']],
        );

        // Inicio incluido (09:00)
        $this->getJson('/api/v1/technicians?available_on=2026-11-19&available_at=09:00')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $tech->id);

        // Mitad de franja (11:30)
        $this->getJson('/api/v1/technicians?available_on=2026-11-19&available_at=11:30')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        // Fin excluido (13:00)
        $this->getJson('/api/v1/technicians?available_on=2026-11-19&available_at=13:00')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_available_at_without_available_on_returns_422(): void
    {
        $this->getJson('/api/v1/technicians?available_at=10:00')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['available_at']);
    }

    public function test_combined_filters_work_together(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 11, 18, 8, 0, 0));

        $specialties = Specialty::query()->orderBy('id')->take(2)->get();
        $targetSpecialty = $specialties[0];
        $otherSpecialty = $specialties[1];

        $match = $this->createTechnician(
            profileOverrides: [
                'headline' => 'Instalación de clima central y minisplit',
                'service_zone' => 'Playa Norte, Ciudad del Carmen',
                'latitude' => 18.6550,
                'longitude' => -91.8250,
            ],
            specialtyIds: [$targetSpecialty->id],
            slots: [['weekday' => 4, 'start_time' => '08:00', 'end_time' => '15:00']],
        );

        // Falla por especialidad distinta
        $this->createTechnician(
            profileOverrides: [
                'headline' => 'Instalación de clima central y minisplit',
                'service_zone' => 'Playa Norte, Ciudad del Carmen',
                'latitude' => 18.6550,
                'longitude' => -91.8250,
            ],
            specialtyIds: [$otherSpecialty->id],
            slots: [['weekday' => 4, 'start_time' => '08:00', 'end_time' => '15:00']],
        );

        // Falla por horario
        $this->createTechnician(
            profileOverrides: [
                'headline' => 'Instalación de clima central y minisplit',
                'service_zone' => 'Playa Norte, Ciudad del Carmen',
                'latitude' => 18.6550,
                'longitude' => -91.8250,
            ],
            specialtyIds: [$targetSpecialty->id],
            slots: [['weekday' => 4, 'start_time' => '16:00', 'end_time' => '20:00']],
        );

        $query = http_build_query([
            'specialty' => $targetSpecialty->slug,
            'q' => 'minisplit',
            'zone' => 'Playa Norte',
            'lat' => 18.6414,
            'lng' => -91.8323,
            'radius_km' => 10,
            'available_on' => '2026-11-19',
            'available_at' => '10:30',
            'sort' => 'distance',
        ]);

        $this->getJson("/api/v1/technicians?{$query}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $match->id);
    }

    public function test_pagination_and_max_per_page_are_enforced(): void
    {
        $specialty = Specialty::query()->firstOrFail();

        for ($i = 0; $i < 15; $i++) {
            $this->createTechnician(
                specialtyIds: [$specialty->id],
                slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
            );
        }

        // Por defecto 12 por página
        $this->getJson('/api/v1/technicians')
            ->assertOk()
            ->assertJsonCount(12, 'data')
            ->assertJsonPath('meta.total', 15)
            ->assertJsonPath('meta.per_page', 12)
            ->assertJsonPath('meta.last_page', 2);

        $this->getJson('/api/v1/technicians?page=2')
            ->assertOk()
            ->assertJsonCount(3, 'data');

        // Máximo permitido: 24
        $this->getJson('/api/v1/technicians?per_page=24')
            ->assertOk()
            ->assertJsonCount(15, 'data')
            ->assertJsonPath('meta.per_page', 24);

        // Mayor a 24 devuelve 422
        $this->getJson('/api/v1/technicians?per_page=25')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['per_page']);
    }

    public function test_search_with_no_results_returns_200_and_empty_list(): void
    {
        $this->getJson('/api/v1/technicians?q=inexistente')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJson([
                'data' => [],
                'links' => [
                    'first' => url('/api/v1/technicians?page=1'),
                    'last' => url('/api/v1/technicians?page=1'),
                    'prev' => null,
                    'next' => null,
                ],
                'meta' => [
                    'current_page' => 1,
                    'from' => null,
                    'last_page' => 1,
                    'path' => url('/api/v1/technicians'),
                    'per_page' => 12,
                    'to' => null,
                    'total' => 0,
                ],
            ]);
    }

    public function test_public_profile_never_exposes_email_phone_user_id_or_exact_coordinates(): void
    {
        $specialty = Specialty::query()->firstOrFail();

        $profile = $this->createTechnician(
            userOverrides: [
                'name' => 'Roberto Pacheco',
                'email' => 'roberto.privado@fixora.test',
                'phone' => '9389876543',
            ],
            profileOverrides: [
                'latitude' => 18.6543219,
                'longitude' => -91.8367894,
            ],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );

        TechnicianService::factory()->create([
            'technician_profile_id' => $profile->id,
            'specialty_id' => $specialty->id,
            'title' => 'Mantenimiento preventivo',
            'is_active' => true,
        ]);

        $response = $this->getJson("/api/v1/technicians/{$profile->id}");
        $response->assertOk()
            ->assertJsonMissingPath('data.email')
            ->assertJsonMissingPath('data.phone')
            ->assertJsonMissingPath('data.user_id');

        $rawContent = (string) $response->getContent();
        $this->assertStringNotContainsString('roberto.privado@fixora.test', $rawContent);
        $this->assertStringNotContainsString('9389876543', $rawContent);
        $this->assertStringNotContainsString('18.6543219', $rawContent);
        $this->assertStringNotContainsString('-91.8367894', $rawContent);
    }

    public function test_public_profile_rounds_coordinates_to_two_decimal_places(): void
    {
        $specialty = Specialty::query()->firstOrFail();

        $profile = $this->createTechnician(
            profileOverrides: [
                'latitude' => 18.6543219,
                'longitude' => -91.8367894,
            ],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
        );

        $this->getJson("/api/v1/technicians/{$profile->id}")
            ->assertOk()
            ->assertJsonPath('data.latitude', 18.65)
            ->assertJsonPath('data.longitude', -91.84);
    }

    public function test_non_visible_or_suspended_technician_profile_returns_404(): void
    {
        $specialty = Specialty::query()->firstOrFail();

        $hidden = $this->createTechnician(
            profileOverrides: ['is_visible' => false],
            specialtyIds: [$specialty->id],
            slots: [],
        );

        $suspended = $this->createTechnician(
            userOverrides: ['status' => UserStatus::Suspended],
            profileOverrides: ['is_visible' => true],
            specialtyIds: [$specialty->id],
            slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
            recalculateVisibility: false,
        );

        $this->getJson("/api/v1/technicians/{$hidden->id}")->assertStatus(404);
        $this->getJson("/api/v1/technicians/{$suspended->id}")->assertStatus(404);
        $this->getJson('/api/v1/technicians/999999')->assertStatus(404);
    }

    public function test_search_listing_has_no_n_plus_one_queries(): void
    {
        $specialties = Specialty::query()->orderBy('id')->take(3)->get();

        for ($i = 0; $i < 10; $i++) {
            $this->createTechnician(
                specialtyIds: $specialties->pluck('id')->all(),
                slots: [['weekday' => 1, 'start_time' => '09:00', 'end_time' => '13:00']],
            );
        }

        DB::flushQueryLog();
        DB::enableQueryLog();

        $this->getJson('/api/v1/technicians?per_page=10')
            ->assertOk()
            ->assertJsonCount(10, 'data');

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        // 1) COUNT(*) para paginación, 2) SELECT de technician_profiles JOIN users, 3) eager load de specialties
        $this->assertLessThanOrEqual(4, count($queries));
    }

    private function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadiusKm = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) * sin($dLat / 2)
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) * sin($dLng / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadiusKm * $c;
    }
}