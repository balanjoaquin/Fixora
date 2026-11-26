<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\ActorRole;
use App\Enums\ServiceRequestStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AvailabilitySlot;
use App\Models\RequestEvent;
use App\Models\Review;
use App\Models\ServiceRequest;
use App\Models\Specialty;
use App\Models\TechnicianProfile;
use App\Models\TechnicianService;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use LogicException;
use Tests\TestCase;

class DatabaseSchemaAndModelsTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_populates_only_six_specialties_and_is_idempotent(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertDatabaseCount('specialties', 6);
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('technician_profiles', 0);
        $this->assertDatabaseCount('specialty_technician', 0);
        $this->assertDatabaseCount('technician_services', 0);
        $this->assertDatabaseCount('availability_slots', 0);
        $this->assertDatabaseCount('service_requests', 0);
        $this->assertDatabaseCount('request_events', 0);
        $this->assertDatabaseCount('reviews', 0);

        $expectedSlugs = [
            'electricidad',
            'plomeria',
            'aire-acondicionado-refrigeracion',
            'computacion',
            'carpinteria',
            'reparacion-de-equipos',
        ];

        $this->assertEqualsCanonicalizing(
            $expectedSlugs,
            Specialty::query()->pluck('slug')->all()
        );

        $this->seed(DatabaseSeeder::class);
        $this->assertDatabaseCount('specialties', 6);
    }

    public function test_unique_constraints_reject_duplicates(): void
    {
        $user = User::factory()->create(['email' => 'unico@fixora.test']);
        $this->assertThrows(
            fn () => User::factory()->create(['email' => 'unico@fixora.test']),
            QueryException::class
        );

        $specialty = Specialty::factory()->create(['slug' => 'slug-unico']);
        $this->assertThrows(
            fn () => Specialty::factory()->create(['slug' => 'slug-unico']),
            QueryException::class
        );

        $techUser = User::factory()->technician()->create();
        $profile = TechnicianProfile::factory()->create(['user_id' => $techUser->id]);
        $this->assertThrows(
            fn () => TechnicianProfile::factory()->create(['user_id' => $techUser->id]),
            QueryException::class
        );

        AvailabilitySlot::factory()->create([
            'technician_profile_id' => $profile->id,
            'weekday' => 2,
            'start_time' => '08:00:00',
            'end_time' => '12:00:00',
        ]);
        $this->assertThrows(
            fn () => AvailabilitySlot::factory()->create([
                'technician_profile_id' => $profile->id,
                'weekday' => 2,
                'start_time' => '08:00:00',
                'end_time' => '14:00:00',
            ]),
            QueryException::class
        );

        $request = ServiceRequest::factory()->create([
            'client_id' => $user->id,
            'technician_profile_id' => $profile->id,
            'specialty_id' => $specialty->id,
        ]);

        Review::factory()->create([
            'service_request_id' => $request->id,
            'client_id' => $user->id,
            'technician_profile_id' => $profile->id,
            'rating' => 5,
        ]);
        $this->assertThrows(
            fn () => Review::factory()->create([
                'service_request_id' => $request->id,
                'client_id' => $user->id,
                'technician_profile_id' => $profile->id,
                'rating' => 4,
            ]),
            QueryException::class
        );
    }

    public function test_check_constraints_reject_invalid_values(): void
    {
        $this->assertThrows(
            fn () => DB::table('users')->insert([
                'name' => 'Invalido',
                'email' => 'rol.invalido@fixora.test',
                'password' => 'hash',
                'role' => 'guest',
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]),
            QueryException::class
        );

        $this->assertThrows(
            fn () => DB::table('users')->insert([
                'name' => 'Estado Invalido',
                'email' => 'estado.invalido@fixora.test',
                'password' => 'hash',
                'role' => 'client',
                'status' => 'deleted',
                'created_at' => now(),
                'updated_at' => now(),
            ]),
            QueryException::class
        );

        $techUser1 = User::factory()->technician()->create();
        $this->assertThrows(
            fn () => TechnicianProfile::factory()->create([
                'user_id' => $techUser1->id,
                'latitude' => '91.0000000',
            ]),
            QueryException::class
        );

        $techUser2 = User::factory()->technician()->create();
        $this->assertThrows(
            fn () => TechnicianProfile::factory()->create([
                'user_id' => $techUser2->id,
                'longitude' => '181.0000000',
            ]),
            QueryException::class
        );

        $validTech = TechnicianProfile::factory()->create();

        $this->assertThrows(
            fn () => AvailabilitySlot::factory()->create([
                'technician_profile_id' => $validTech->id,
                'weekday' => 0,
                'start_time' => '09:00:00',
                'end_time' => '11:00:00',
            ]),
            QueryException::class
        );

        $this->assertThrows(
            fn () => AvailabilitySlot::factory()->create([
                'technician_profile_id' => $validTech->id,
                'weekday' => 8,
                'start_time' => '09:00:00',
                'end_time' => '11:00:00',
            ]),
            QueryException::class
        );

        $this->assertThrows(
            fn () => AvailabilitySlot::factory()->create([
                'technician_profile_id' => $validTech->id,
                'weekday' => 3,
                'start_time' => '12:00:00',
                'end_time' => '12:00:00',
            ]),
            QueryException::class
        );

        $this->assertThrows(
            fn () => AvailabilitySlot::factory()->create([
                'technician_profile_id' => $validTech->id,
                'weekday' => 4,
                'start_time' => '14:00:00',
                'end_time' => '10:00:00',
            ]),
            QueryException::class
        );

        $client = User::factory()->create();
        $specialty = Specialty::factory()->create();

        $this->assertThrows(
            fn () => DB::table('service_requests')->insert([
                'client_id' => $client->id,
                'technician_profile_id' => $validTech->id,
                'specialty_id' => $specialty->id,
                'title' => 'Solicitud estado inválido',
                'description' => 'Descripción',
                'address_line' => 'Dirección',
                'approx_zone' => 'Zona',
                'preferred_date' => now()->toDateString(),
                'preferred_start' => '10:00:00',
                'status' => 'unknown_status',
                'expires_at' => now()->addHours(48),
                'created_at' => now(),
                'updated_at' => now(),
            ]),
            QueryException::class
        );

        $request = ServiceRequest::factory()->create([
            'client_id' => $client->id,
            'technician_profile_id' => $validTech->id,
            'specialty_id' => $specialty->id,
        ]);

        $this->assertThrows(
            fn () => DB::table('request_events')->insert([
                'service_request_id' => $request->id,
                'from_status' => null,
                'to_status' => 'pending',
                'actor_id' => $client->id,
                'actor_role' => 'admin',
                'reason' => null,
                'created_at' => now(),
            ]),
            QueryException::class
        );

        $this->assertThrows(
            fn () => Review::factory()->create([
                'service_request_id' => $request->id,
                'client_id' => $client->id,
                'technician_profile_id' => $validTech->id,
                'rating' => 0,
            ]),
            QueryException::class
        );

        $this->assertThrows(
            fn () => Review::factory()->create([
                'service_request_id' => $request->id,
                'client_id' => $client->id,
                'technician_profile_id' => $validTech->id,
                'rating' => 6,
            ]),
            QueryException::class
        );
    }

    public function test_request_events_is_immutable_in_eloquent_and_mysql(): void
    {
        $event = RequestEvent::factory()->create();

        $this->assertThrows(function () use ($event): void {
            $event->reason = 'Intento de edición Eloquent';
            $event->save();
        }, LogicException::class);

        $this->assertThrows(
            fn () => $event->delete(),
            LogicException::class
        );

        $this->assertThrows(
            fn () => DB::table('request_events')
                ->where('id', $event->id)
                ->update(['reason' => 'Intento SQL directo']),
            QueryException::class
        );

        $this->assertThrows(
            fn () => DB::table('request_events')
                ->where('id', $event->id)
                ->delete(),
            QueryException::class
        );

        $this->assertDatabaseHas('request_events', ['id' => $event->id]);
    }

    public function test_eloquent_relationships_and_enum_casts_work(): void
    {
        $client = User::factory()->create([
            'role' => UserRole::Client,
            'status' => UserStatus::Active,
        ]);
        $techUser = User::factory()->technician()->create();
        $profile = TechnicianProfile::factory()->create(['user_id' => $techUser->id]);
        $specialty = Specialty::factory()->create();
        $profile->specialties()->attach($specialty->id);

        $service = TechnicianService::factory()->create([
            'technician_profile_id' => $profile->id,
            'specialty_id' => $specialty->id,
        ]);

        $slot = AvailabilitySlot::factory()->create([
            'technician_profile_id' => $profile->id,
        ]);

        $request = ServiceRequest::factory()->create([
            'client_id' => $client->id,
            'technician_profile_id' => $profile->id,
            'specialty_id' => $specialty->id,
            'technician_service_id' => $service->id,
            'status' => ServiceRequestStatus::Pending,
        ]);

        $event = RequestEvent::factory()->create([
            'service_request_id' => $request->id,
            'from_status' => null,
            'to_status' => ServiceRequestStatus::Pending,
            'actor_id' => $client->id,
            'actor_role' => ActorRole::Client,
        ]);

        $review = Review::factory()->create([
            'service_request_id' => $request->id,
            'client_id' => $client->id,
            'technician_profile_id' => $profile->id,
            'rating' => 5,
        ]);

        $this->assertSame(UserRole::Client, $client->fresh()->role);
        $this->assertSame(UserStatus::Active, $client->fresh()->status);
        $this->assertSame(ServiceRequestStatus::Pending, $request->fresh()->status);
        $this->assertSame(ActorRole::Client, $event->fresh()->actor_role);
        $this->assertTrue($profile->specialties->contains($specialty));
        $this->assertTrue($profile->services->contains($service));
        $this->assertTrue($profile->availabilitySlots->contains($slot));
        $this->assertTrue($request->events->contains($event));
        $this->assertSame($review->id, $request->review->id);
    }
}