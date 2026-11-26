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
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthAndProfileApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_valid_client_registration(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Cliente Nuevo',
            'email' => 'cliente@fixora.test',
            'password' => 'Clave1234',
            'password_confirmation' => 'Clave1234',
            'phone' => '938-123-4567',
            'role' => 'client',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.user.email', 'cliente@fixora.test')
            ->assertJsonPath('data.user.phone', '9381234567')
            ->assertJsonPath('data.user.role', 'client')
            ->assertJsonStructure(['message', 'data' => ['user', 'token', 'token_type']]);

        $this->assertDatabaseHas('users', [
            'email' => 'cliente@fixora.test',
            'phone' => '9381234567',
            'role' => 'client',
        ]);
        $this->assertDatabaseCount('technician_profiles', 0);
    }

    public function test_valid_technician_registration_creates_empty_invisible_profile(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Tecnico Nuevo',
            'email' => 'tecnico@fixora.test',
            'password' => 'Clave1234',
            'password_confirmation' => 'Clave1234',
            'phone' => '938 987 6543',
            'role' => 'technician',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.user.role', 'technician')
            ->assertJsonPath('data.user.technician_profile.is_visible', false);

        $user = User::query()->where('email', 'tecnico@fixora.test')->firstOrFail();

        $this->assertDatabaseHas('technician_profiles', [
            'user_id' => $user->id,
            'is_visible' => 0,
            'years_experience' => 0,
        ]);
    }

    public function test_duplicate_email_is_rejected_with_422(): void
    {
        User::factory()->create(['email' => 'duplicado@fixora.test']);

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Otro Usuario',
            'email' => 'duplicado@fixora.test',
            'password' => 'Clave1234',
            'password_confirmation' => 'Clave1234',
            'phone' => '9381112233',
            'role' => 'client',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_uppercase_email_is_saved_in_lowercase(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Usuario Mayusculas',
            'email' => 'MAYUSCULAS@FIXORA.TEST',
            'password' => 'Clave1234',
            'password_confirmation' => 'Clave1234',
            'phone' => '9382223344',
            'role' => 'client',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.user.email', 'mayusculas@fixora.test');

        $this->assertDatabaseHas('users', [
            'email' => 'mayusculas@fixora.test',
        ]);
    }

    public function test_admin_role_is_rejected_on_registration(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Intento Admin',
            'email' => 'admin.intento@fixora.test',
            'password' => 'Clave1234',
            'password_confirmation' => 'Clave1234',
            'phone' => '9383334455',
            'role' => 'admin',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['role']);
    }

    public function test_invalid_phone_is_rejected(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Telefono Corto',
            'email' => 'tel.invalido@fixora.test',
            'password' => 'Clave1234',
            'password_confirmation' => 'Clave1234',
            'phone' => '938-123',
            'role' => 'client',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    public function test_weak_password_is_rejected(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Clave Debil',
            'email' => 'clave.debil@fixora.test',
            'password' => 'sololetras',
            'password_confirmation' => 'sololetras',
            'phone' => '9384445566',
            'role' => 'client',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    public function test_valid_login_returns_token(): void
    {
        User::factory()->create([
            'email' => 'login.ok@fixora.test',
            'password' => Hash::make('Clave1234'),
            'role' => UserRole::Client,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'LOGIN.OK@FIXORA.TEST',
            'password' => 'Clave1234',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['message', 'data' => ['user', 'token', 'token_type']]);
    }

    public function test_invalid_login_returns_generic_message(): void
    {
        User::factory()->create([
            'email' => 'existe@fixora.test',
            'password' => Hash::make('Clave1234'),
        ]);

        $wrongPasswordResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'existe@fixora.test',
            'password' => 'Incorrecta99',
        ]);

        $unknownEmailResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'noexiste@fixora.test',
            'password' => 'Incorrecta99',
        ]);

        $wrongPasswordResponse->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Credenciales incorrectas.');

        $unknownEmailResponse->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Credenciales incorrectas.');
    }

    public function test_sixth_failed_login_attempt_returns_429(): void
    {
        User::factory()->create([
            'email' => 'bloqueo@fixora.test',
            'password' => Hash::make('Clave1234'),
        ]);

        for ($i = 1; $i <= 5; $i++) {
            $this->postJson('/api/v1/auth/login', [
                'email' => 'bloqueo@fixora.test',
                'password' => 'MalaClave1',
            ])->assertStatus(422);
        }

        $sixth = $this->postJson('/api/v1/auth/login', [
            'email' => 'bloqueo@fixora.test',
            'password' => 'MalaClave1',
        ]);

        $sixth->assertStatus(429)
            ->assertHeader('Retry-After');
    }

    public function test_suspended_user_receives_403_on_login_and_existing_token_stops_working(): void
    {
        $user = User::factory()->create([
            'email' => 'suspendido@fixora.test',
            'password' => Hash::make('Clave1234'),
            'status' => UserStatus::Active,
        ]);

        $token = $user->createToken('test-token')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/v1/auth/me')
            ->assertOk();

        $user->update([
            'status' => UserStatus::Suspended,
            'suspended_at' => now()->utc(),
            'suspended_reason' => 'Suspensión de prueba',
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'suspendido@fixora.test',
            'password' => 'Clave1234',
        ])->assertStatus(403);

        $this->withToken($token)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(403);
    }

    public function test_admin_cannot_login_in_main_app(): void
    {
        User::factory()->admin()->create([
            'email' => 'admin@fixora.test',
            'password' => Hash::make('Clave1234'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@fixora.test',
            'password' => 'Clave1234',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Credenciales incorrectas.');
    }

    public function test_logout_revokes_current_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('session-token')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/auth/logout')
            ->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_me_returns_only_own_account_data(): void
    {
        $userA = User::factory()->create(['email' => 'propio@fixora.test']);
        $userB = User::factory()->create(['email' => 'ajeno@fixora.test']);

        $token = $userA->createToken('token-a')->plainTextToken;

        $response = $this->withToken($token)->getJson('/api/v1/auth/me');

        $response->assertOk()
            ->assertJsonPath('data.id', $userA->id)
            ->assertJsonPath('data.email', 'propio@fixora.test')
            ->assertJsonMissing(['email' => 'ajeno@fixora.test']);
    }

    public function test_change_password_fails_with_wrong_current_and_revokes_other_tokens_when_valid(): void
    {
        $user = User::factory()->create([
            'password' => Hash::make('ClaveActual1'),
        ]);

        $currentToken = $user->createToken('device-1')->plainTextToken;
        $otherToken = $user->createToken('device-2')->plainTextToken;

        $this->withToken($currentToken)
            ->putJson('/api/v1/me/password', [
                'current_password' => 'Incorrecta1',
                'password' => 'ClaveNueva2',
                'password_confirmation' => 'ClaveNueva2',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['current_password']);

        $this->withToken($currentToken)
            ->putJson('/api/v1/me/password', [
                'current_password' => 'ClaveActual1',
                'password' => 'ClaveNueva2',
                'password_confirmation' => 'ClaveNueva2',
            ])
            ->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 1);
        $this->assertNotSame($otherToken, $currentToken);
    }

    public function test_technician_edits_own_profile_and_cannot_edit_another_technician_profile(): void
    {
        $techA = User::factory()->technician()->create();
        $profileA = TechnicianProfile::factory()->create([
            'user_id' => $techA->id,
            'headline' => 'Original A',
        ]);

        $techB = User::factory()->technician()->create();
        $profileB = TechnicianProfile::factory()->create([
            'user_id' => $techB->id,
            'headline' => 'Original B',
        ]);

        $tokenA = $techA->createToken('tech-a')->plainTextToken;

        $response = $this->withToken($tokenA)
            ->putJson('/api/v1/technician/profile', [
                'headline' => 'Especialista certificado',
                'bio' => 'Atención residencial y comercial.',
                'years_experience' => 7,
                'service_zone' => 'Playa Norte',
                'latitude' => 18.654321,
                'longitude' => -91.812345,
                'service_radius_km' => 15,
            ]);

        $response->assertOk()
            ->assertJsonPath('data.id', $profileA->id)
            ->assertJsonPath('data.headline', 'Especialista certificado')
            ->assertJsonPath('data.years_experience', 7);

        $this->assertDatabaseHas('technician_profiles', [
            'id' => $profileB->id,
            'headline' => 'Original B',
        ]);
    }

    public function test_client_receives_403_on_technician_endpoints(): void
    {
        $client = User::factory()->create(['role' => UserRole::Client]);
        $token = $client->createToken('client-token')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/v1/technician/profile')
            ->assertStatus(403);

        $this->withToken($token)
            ->getJson('/api/v1/technician/services')
            ->assertStatus(403);
    }

    public function test_sync_specialties_rejects_nonexistent_or_inactive_ids(): void
    {
        $this->seed(SpecialtySeeder::class);
        $activeSpecialty = Specialty::query()->where('is_active', true)->firstOrFail();
        $inactiveSpecialty = Specialty::factory()->create(['is_active' => false]);

        $tech = User::factory()->technician()->create();
        TechnicianProfile::factory()->create(['user_id' => $tech->id]);
        $token = $tech->createToken('tech-token')->plainTextToken;

        $this->withToken($token)
            ->putJson('/api/v1/technician/specialties', [
                'specialty_ids' => [999999],
            ])
            ->assertStatus(422);

        $this->withToken($token)
            ->putJson('/api/v1/technician/specialties', [
                'specialty_ids' => [$inactiveSpecialty->id],
            ])
            ->assertStatus(422);

        $this->withToken($token)
            ->putJson('/api/v1/technician/specialties', [
                'specialty_ids' => [$activeSpecialty->id],
            ])
            ->assertOk();
    }

    public function test_creating_service_with_unassigned_specialty_fails(): void
    {
        $this->seed(SpecialtySeeder::class);
        $assigned = Specialty::query()->orderBy('id')->firstOrFail();
        $unassigned = Specialty::query()->orderByDesc('id')->firstOrFail();

        $tech = User::factory()->technician()->create();
        $profile = TechnicianProfile::factory()->create(['user_id' => $tech->id]);
        $profile->specialties()->sync([$assigned->id]);

        $token = $tech->createToken('tech-token')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/technician/services', [
                'specialty_id' => $unassigned->id,
                'title' => 'Servicio no permitido',
                'description' => 'Detalle de prueba',
                'reference_price' => 450.00,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['specialty_id']);
    }

    public function test_technician_cannot_view_or_edit_another_technicians_services(): void
    {
        $this->seed(SpecialtySeeder::class);
        $specialty = Specialty::query()->firstOrFail();

        $techA = User::factory()->technician()->create();
        $profileA = TechnicianProfile::factory()->create(['user_id' => $techA->id]);
        $profileA->specialties()->sync([$specialty->id]);

        $techB = User::factory()->technician()->create();
        $profileB = TechnicianProfile::factory()->create(['user_id' => $techB->id]);
        $profileB->specialties()->sync([$specialty->id]);

        $serviceB = TechnicianService::factory()->create([
            'technician_profile_id' => $profileB->id,
            'specialty_id' => $specialty->id,
            'title' => 'Servicio exclusivo de B',
        ]);

        $tokenA = $techA->createToken('tech-a')->plainTextToken;

        $this->withToken($tokenA)
            ->getJson('/api/v1/technician/services')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->withToken($tokenA)
            ->putJson("/api/v1/technician/services/{$serviceB->id}", [
                'title' => 'Intento de modificación ajena',
            ])
            ->assertStatus(403);
    }

    public function test_visibility_becomes_true_only_when_all_conditions_are_met_and_reverts_when_one_is_removed(): void
    {
        $this->seed(SpecialtySeeder::class);
        $specialty = Specialty::query()->firstOrFail();

        $tech = User::factory()->technician()->create([
            'status' => UserStatus::Active,
            'phone' => '9385556677',
        ]);
        $profile = TechnicianProfile::factory()->create([
            'user_id' => $tech->id,
            'latitude' => null,
            'longitude' => null,
            'is_visible' => false,
        ]);

        $token = $tech->createToken('tech-vis')->plainTextToken;

        // 1. Agrega coordenadas (falta especialidad y franja) -> sigue en 0
        $this->withToken($token)
            ->putJson('/api/v1/technician/profile', [
                'years_experience' => 4,
                'latitude' => 18.6414,
                'longitude' => -91.8323,
            ])
            ->assertOk()
            ->assertJsonPath('data.is_visible', false);

        // 2. Agrega especialidad (falta franja) -> sigue en 0
        $this->withToken($token)
            ->putJson('/api/v1/technician/specialties', [
                'specialty_ids' => [$specialty->id],
            ])
            ->assertOk()
            ->assertJsonPath('data.is_visible', false);

        // 3. Agrega franja de disponibilidad (se cumplen las 5 condiciones) -> pasa a 1
        AvailabilitySlot::factory()->create([
            'technician_profile_id' => $profile->id,
        ]);
        app(ProfileVisibilityService::class)->recalculate($profile);
        $this->assertTrue($profile->fresh()->is_visible);

        // 4. Quita coordenadas -> vuelve a 0
        $this->withToken($token)
            ->putJson('/api/v1/technician/profile', [
                'years_experience' => 4,
                'latitude' => null,
                'longitude' => null,
            ])
            ->assertOk()
            ->assertJsonPath('data.is_visible', false);
    }

    public function test_no_response_exposes_password_or_remember_token(): void
    {
        $registerResponse = $this->postJson('/api/v1/auth/register', [
            'name' => 'Privacidad Test',
            'email' => 'privacidad@fixora.test',
            'password' => 'Clave1234',
            'password_confirmation' => 'Clave1234',
            'phone' => '9387778899',
            'role' => 'client',
        ]);

        $registerResponse->assertCreated();
        $content = (string) $registerResponse->getContent();
        $this->assertStringNotContainsString('password', $content);
        $this->assertStringNotContainsString('remember_token', $content);

        $token = $registerResponse->json('data.token');
        $meResponse = $this->withToken($token)->getJson('/api/v1/auth/me');
        $meContent = (string) $meResponse->getContent();
        $this->assertStringNotContainsString('password', $meContent);
        $this->assertStringNotContainsString('remember_token', $meContent);
    }

    public function test_deleting_service_performs_soft_deactivation(): void
    {
        $this->seed(SpecialtySeeder::class);
        $specialty = Specialty::query()->firstOrFail();

        $tech = User::factory()->technician()->create();
        $profile = TechnicianProfile::factory()->create(['user_id' => $tech->id]);
        $profile->specialties()->sync([$specialty->id]);

        $service = TechnicianService::factory()->create([
            'technician_profile_id' => $profile->id,
            'specialty_id' => $specialty->id,
            'is_active' => true,
        ]);

        $token = $tech->createToken('tech-del')->plainTextToken;

        $this->withToken($token)
            ->deleteJson("/api/v1/technician/services/{$service->id}")
            ->assertOk();

        $this->assertDatabaseHas('technician_services', [
            'id' => $service->id,
            'is_active' => 0,
        ]);
    }
}