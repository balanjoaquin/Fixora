<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Enums\ServiceRequestStatus;
use App\Enums\UserStatus;
use App\Models\AvailabilitySlot;
use App\Models\ServiceRequest;
use App\Models\Specialty;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Notifications\RequestAcceptedNotification;
use App\Notifications\RequestCancelledNotification;
use App\Notifications\RequestCompletedNotification;
use App\Notifications\RequestCreatedNotification;
use App\Notifications\RequestExpiredClientNotification;
use App\Notifications\RequestExpiredTechnicianNotification;
use App\Notifications\RequestExpiringSoonNotification;
use App\Notifications\RequestInProgressNotification;
use App\Notifications\RequestRejectedNotification;
use App\Notifications\ReviewReceivedNotification;
use App\Notifications\ReviewRepliedNotification;
use App\Services\ReviewService;
use App\Services\ServiceRequestService;
use App\Services\ServiceRequestStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationFlowTest extends TestCase
{
    use RefreshDatabase;

    private function createTechnicianSetup(bool $verified = true): array
    {
        $specialty = Specialty::query()->create([
            'name' => 'Aire Acondicionado',
            'slug' => 'aire-acondicionado-' . uniqid(),
            'is_active' => true,
        ]);

        $factory = User::factory()->technician();
        if (! $verified) {
            $factory = $factory->unverified();
        }

        /** @var User $techUser */
        $techUser = $factory->create([
            'phone' => '9389998877',
            'email' => 'tecnico.' . uniqid() . '@example.test',
        ]);

        /** @var TechnicianProfile $profile */
        $profile = TechnicianProfile::query()->create([
            'user_id' => $techUser->id,
            'headline' => 'Técnico en refrigeración',
            'bio' => 'Mantenimiento preventivo y correctivo.',
            'service_zone' => 'Centro',
            'years_experience' => 6,
            'latitude' => 18.6422,
            'longitude' => -91.8311,
            'is_visible' => true,
        ]);
        $profile->specialties()->attach($specialty->id);

        for ($day = 1; $day <= 7; $day++) {
            AvailabilitySlot::query()->create([
                'technician_profile_id' => $profile->id,
                'weekday' => $day,
                'start_time' => '08:00:00',
                'end_time' => '20:00:00',
            ]);
        }

        return [$techUser, $profile, $specialty];
    }

    public function test_request_lifecycle_sends_notifications_and_respects_privacy_and_verification(): void
    {
        Notification::fake();

        [$techUser, $profile, $specialty] = $this->createTechnicianSetup(verified: false);

        /** @var User $client */
        $client = User::factory()->create([
            'phone' => '9381234567',
            'email' => 'cliente.verificado@example.test',
        ]);

        $requestService = app(ServiceRequestService::class);
        $stateMachine = app(ServiceRequestStateMachine::class);

        $tomorrow = now('America/Mexico_City')->addDay()->format('Y-m-d');
        $serviceRequest = $requestService->create($client, [
            'technician_profile_id' => $profile->id,
            'specialty_id' => $specialty->id,
            'title' => 'Mantenimiento minisplit',
            'description' => 'No enfría correctamente.',
            'address_line' => 'Calle Privada Secret 999',
            'approx_zone' => 'Colonia Petrolera',
            'latitude' => 18.6499,
            'longitude' => -91.8299,
            'preferred_date' => $tomorrow,
            'preferred_start' => '09:00',
        ]);

        // Técnico sin correo verificado: solo canal database, sin correo electrónico
        Notification::assertSentTo(
            $techUser,
            RequestCreatedNotification::class,
            function (RequestCreatedNotification $notification, array $channels) use ($techUser, $client): bool {
                $data = $notification->toArray($techUser);
                $serialized = json_encode($data, JSON_THROW_ON_ERROR);

                $this->assertSame(['database'], $channels);
                $this->assertStringNotContainsString($client->phone, $serialized);
                $this->assertStringNotContainsString($client->email, $serialized);
                $this->assertStringNotContainsString('Calle Privada Secret 999', $serialized);
                $this->assertStringNotContainsString('18.6499', $serialized);

                return $data['type'] === 'request.created';
            }
        );

        // Aceptar -> notifica al cliente (database + mail porque el cliente sí está verificado)
        $serviceRequest = $stateMachine->accept($serviceRequest, $techUser);
        Notification::assertSentTo(
            $client,
            RequestAcceptedNotification::class,
            function (RequestAcceptedNotification $notification, array $channels) use ($client, $techUser): bool {
                $data = $notification->toArray($client);
                $serialized = json_encode($data, JSON_THROW_ON_ERROR);

                $this->assertSame(['database', 'mail'], $channels);
                $this->assertStringNotContainsString($techUser->phone, $serialized);
                $this->assertStringNotContainsString($techUser->email, $serialized);
                $this->assertStringNotContainsString('Calle Privada Secret 999', $serialized);

                return $data['type'] === 'request.accepted';
            }
        );

        // Avanzar el reloj al día programado (el servicio no puede iniciar antes de su fecha)
        $this->travelTo(now('America/Mexico_City')->addDay()->setTime(10, 0));

        // Iniciar -> notifica al cliente
        $serviceRequest = $stateMachine->start($serviceRequest, $techUser);
        Notification::assertSentTo($client, RequestInProgressNotification::class);

        // Completar -> notifica al cliente
        $serviceRequest = $stateMachine->complete($serviceRequest, $techUser);
        Notification::assertSentTo($client, RequestCompletedNotification::class);

        // Reseña y respuesta -> notifican a técnico y cliente respectivamente
        $reviewService = app(ReviewService::class);
        $review = $reviewService->createForRequest($client, $serviceRequest, 5, 'Excelente trabajo.');
        Notification::assertSentTo($techUser, ReviewReceivedNotification::class);

        $reviewService->replyToReview($techUser, $review, 'Muchas gracias por su confianza.');
        Notification::assertSentTo($client, ReviewRepliedNotification::class);
    }

    public function test_rejection_cancellation_expiration_and_expiring_soon_command(): void
    {
        Notification::fake();

        [$techUser, $profile, $specialty] = $this->createTechnicianSetup(verified: true);
        /** @var User $client */
        $client = User::factory()->create();

        $requestService = app(ServiceRequestService::class);
        $stateMachine = app(ServiceRequestStateMachine::class);

        $tomorrow = now('America/Mexico_City')->addDay()->format('Y-m-d');

        // 1) Rechazo
        $req1 = $requestService->create($client, [
            'technician_profile_id' => $profile->id,
            'specialty_id' => $specialty->id,
            'title' => 'Solicitud 1',
            'description' => 'Detalle 1',
            'address_line' => 'Dirección 1',
            'approx_zone' => 'Zona 1',
            'preferred_date' => $tomorrow,
            'preferred_start' => '10:00',
        ]);
        $stateMachine->reject($req1, $techUser, 'Agenda llena ese día');
        Notification::assertSentTo(
            $client,
            RequestRejectedNotification::class,
            fn (RequestRejectedNotification $n): bool => str_contains($n->toArray($client)['body'], 'Agenda llena ese día')
        );

        // 2) Cancelación por cliente
        $req2 = $requestService->create($client, [
            'technician_profile_id' => $profile->id,
            'specialty_id' => $specialty->id,
            'title' => 'Solicitud 2',
            'description' => 'Detalle 2',
            'address_line' => 'Dirección 2',
            'approx_zone' => 'Zona 2',
            'preferred_date' => $tomorrow,
            'preferred_start' => '11:00',
        ]);
        $stateMachine->cancel($req2, $client, 'Cambio de planes');
        Notification::assertSentTo($techUser, RequestCancelledNotification::class);
        Notification::assertNotSentTo($client, RequestCancelledNotification::class);

        // 3) Aviso de vencimiento próximo (solo una vez)
        $req3 = $requestService->create($client, [
            'technician_profile_id' => $profile->id,
            'specialty_id' => $specialty->id,
            'title' => 'Solicitud 3 por vencer',
            'description' => 'Detalle 3',
            'address_line' => 'Dirección 3',
            'approx_zone' => 'Zona 3',
            'preferred_date' => $tomorrow,
            'preferred_start' => '12:00',
        ]);
        $req3->forceFill(['expires_at' => now()->utc()->addHours(4)])->save();

        $this->artisan('fixora:notify-expiring-requests')->assertSuccessful();
        $this->artisan('fixora:notify-expiring-requests')->assertSuccessful();

        Notification::assertSentToTimes($techUser, RequestExpiringSoonNotification::class, 1);

        // 4) Expiración
        $req3->forceFill(['expires_at' => now()->utc()->subMinute()])->save();
        $stateMachine->expire($req3);

        Notification::assertSentTo($client, RequestExpiredClientNotification::class);
        Notification::assertSentTo($techUser, RequestExpiredTechnicianNotification::class);
    }

    public function test_suspended_user_receives_no_notifications(): void
    {
        Notification::fake();

        [$techUser, $profile, $specialty] = $this->createTechnicianSetup(verified: true);
        /** @var User $client */
        $client = User::factory()->create();

        $req = app(ServiceRequestService::class)->create($client, [
            'technician_profile_id' => $profile->id,
            'specialty_id' => $specialty->id,
            'title' => 'Servicio suspendido',
            'description' => 'Prueba suspensión',
            'address_line' => 'Dirección X',
            'approx_zone' => 'Zona X',
            'preferred_date' => now('America/Mexico_City')->addDay()->format('Y-m-d'),
            'preferred_start' => '10:00',
        ]);

        $client->forceFill(['status' => UserStatus::Suspended])->save();

        app(ServiceRequestStateMachine::class)->accept($req, $techUser);

        Notification::assertNotSentTo($client, RequestAcceptedNotification::class);
    }

    public function test_notifications_api_endpoints_and_prune_command(): void
    {
        /** @var User $user */
        $user = User::factory()->create();
        /** @var User $otherUser */
        $otherUser = User::factory()->create();

        $n1 = DatabaseNotification::query()->create([
            'id' => (string) str()->uuid(),
            'type' => RequestAcceptedNotification::class,
            'notifiable_type' => User::class,
            'notifiable_id' => $user->id,
            'data' => [
                'type' => 'request.accepted',
                'title' => 'Solicitud aceptada',
                'body' => 'Tu solicitud fue aceptada.',
                'request_id' => 1,
                'url' => 'http://localhost:3000/requests/1',
            ],
            'read_at' => null,
        ]);

        $n2 = DatabaseNotification::query()->create([
            'id' => (string) str()->uuid(),
            'type' => RequestCompletedNotification::class,
            'notifiable_type' => User::class,
            'notifiable_id' => $user->id,
            'data' => [
                'type' => 'request.completed',
                'title' => 'Servicio completado',
                'body' => 'Tu servicio fue completado.',
                'request_id' => 1,
                'url' => 'http://localhost:3000/requests/1',
            ],
            'read_at' => now(),
        ]);

        $otherNotification = DatabaseNotification::query()->create([
            'id' => (string) str()->uuid(),
            'type' => RequestAcceptedNotification::class,
            'notifiable_type' => User::class,
            'notifiable_id' => $otherUser->id,
            'data' => [
                'type' => 'request.accepted',
                'title' => 'Ajena',
                'body' => 'Notificación de otro usuario.',
                'url' => 'http://localhost:3000/requests/2',
            ],
            'read_at' => null,
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/v1/notifications/unread-count')
            ->assertOk()
            ->assertExactJson(['unread_count' => 1]);

        $this->getJson('/api/v1/notifications?unread=true')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $n1->id);

        // No puede marcar notificación de otro usuario
        $this->postJson("/api/v1/notifications/{$otherNotification->id}/read")
            ->assertNotFound();

        // Marca la propia como leída
        $this->postJson("/api/v1/notifications/{$n1->id}/read")
            ->assertOk()
            ->assertJsonPath('data.id', $n1->id);

        $this->getJson('/api/v1/notifications/unread-count')
            ->assertOk()
            ->assertExactJson(['unread_count' => 0]);

        // Crear nueva sin leer y probar read-all
        DatabaseNotification::query()->create([
            'id' => (string) str()->uuid(),
            'type' => RequestInProgressNotification::class,
            'notifiable_type' => User::class,
            'notifiable_id' => $user->id,
            'data' => [
                'type' => 'request.in_progress',
                'title' => 'Iniciado',
                'body' => 'El técnico inició tu servicio.',
                'url' => 'http://localhost:3000/requests/1',
            ],
            'read_at' => null,
        ]);

        $this->postJson('/api/v1/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('updated_count', 1);

        // Depuración de antiguas
        DatabaseNotification::query()->whereKey($n2->id)->update([
            'created_at' => now()->subDays(95),
        ]);

        $this->artisan('fixora:prune-notifications')->assertSuccessful();
        $this->assertDatabaseMissing('notifications', ['id' => $n2->id]);
    }
}