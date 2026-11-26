<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Enums\ServiceRequestStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AvailabilitySlot;
use App\Models\Review;
use App\Models\ServiceRequest;
use App\Models\Specialty;
use App\Models\TechnicianProfile;
use App\Models\TechnicianService;
use App\Models\User;
use App\Services\ProfileVisibilityService;
use App\Services\ReviewService;
use Database\Seeders\SpecialtySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class ReviewApiTest extends TestCase
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

    private function setLocalTestNow(string $localDateTime = '2026-11-18 10:00:00'): void
    {
        Carbon::setTestNow(Carbon::parse($localDateTime, 'America/Mexico_City'));
    }

    /**
     * @return array{user: User, profile: TechnicianProfile, specialty: Specialty, service: TechnicianService}
     */
    private function createReadyTechnician(
        string $name = 'Carlos Méndez',
        string $email = 'carlos.tech@fixora.test',
        string $phone = '9381112233',
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
            'rating_avg' => 0.00,
            'rating_count' => 0,
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

        foreach ([1, 2, 3, 4, 5, 6, 7] as $weekday) {
            AvailabilitySlot::factory()->create([
                'technician_profile_id' => $profile->id,
                'weekday' => $weekday,
                'start_time' => '08:00',
                'end_time' => '20:00',
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
        string $name = 'Ana Pérez',
        string $email = 'ana.client@fixora.test',
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
     * @param array{user: User, profile: TechnicianProfile, specialty: Specialty, service: TechnicianService} $tech
     */
    private function createRequestWithStatus(
        User $client,
        array $tech,
        ServiceRequestStatus $status = ServiceRequestStatus::Completed,
    ): ServiceRequest {
        /** @var ServiceRequest $serviceRequest */
        $serviceRequest = ServiceRequest::factory()->create([
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'specialty_id' => $tech['specialty']->id,
            'technician_service_id' => $tech['service']->id,
            'title' => 'Revisión confidencial de circuito',
            'description' => 'Descripción detallada confidencial del predio.',
            'address_line' => 'Calle Secreta 999, Col. Petrolera',
            'approx_zone' => 'Colonia Petrolera, Ciudad del Carmen',
            'latitude' => 18.6451234,
            'longitude' => -91.8219876,
            'preferred_date' => '2026-11-19',
            'preferred_start' => '10:00:00',
            'status' => $status,
            'expires_at' => Carbon::now('UTC')->addHours(48),
            'accepted_at' => in_array($status, [ServiceRequestStatus::Accepted, ServiceRequestStatus::InProgress, ServiceRequestStatus::Completed], true) ? Carbon::now('UTC') : null,
            'started_at' => in_array($status, [ServiceRequestStatus::InProgress, ServiceRequestStatus::Completed], true) ? Carbon::now('UTC') : null,
            'completed_at' => $status === ServiceRequestStatus::Completed ? Carbon::now('UTC') : null,
            'closed_at' => in_array($status, [ServiceRequestStatus::Rejected, ServiceRequestStatus::Cancelled, ServiceRequestStatus::Expired], true) ? Carbon::now('UTC') : null,
        ]);

        return $serviceRequest;
    }

    // -------------------------------------------------------------------------
    // CREACIÓN DE RESEÑA
    // -------------------------------------------------------------------------

    public function test_client_can_review_completed_request(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient('Ana Pérez');
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $token = $client->createToken('client')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/v1/requests/{$req->id}/review", [
                'rating' => 5,
                'comment' => 'Excelente atención, puntual y muy profesional.',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.rating', 5)
            ->assertJsonPath('data.comment', 'Excelente atención, puntual y muy profesional.')
            ->assertJsonPath('data.client_name', 'Ana P.')
            ->assertJsonPath('data.specialty', $tech['specialty']->name)
            ->assertJsonPath('data.technician_reply', null);

        $this->assertDatabaseHas('reviews', [
            'service_request_id' => $req->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
            'is_hidden' => false,
        ]);

        $freshProfile = $tech['profile']->fresh();
        $this->assertSame('5.00', number_format((float) $freshProfile->rating_avg, 2, '.', ''));
        $this->assertSame(1, (int) $freshProfile->rating_count);
    }

    public function test_invalid_ratings_are_rejected_with_422(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $token = $client->createToken('client')->plainTextToken;

        foreach ([0, 6, 3.5, 'abc'] as $invalidRating) {
            $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);

            $this->withToken($token)
                ->postJson("/api/v1/requests/{$req->id}/review", [
                    'rating' => $invalidRating,
                    'comment' => 'Comentario válido.',
                ])
                ->assertStatus(422)
                ->assertJsonValidationErrors(['rating']);
        }
    }

    public function test_comment_longer_than_1000_characters_is_rejected_with_422(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $token = $client->createToken('client')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/v1/requests/{$req->id}/review", [
                'rating' => 4,
                'comment' => str_repeat('a', 1001),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['comment']);
    }

    public function test_missing_comment_is_accepted_and_stored_as_null(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $token = $client->createToken('client')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/v1/requests/{$req->id}/review", [
                'rating' => 5,
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.comment', null);

        $this->assertDatabaseHas('reviews', [
            'service_request_id' => $req->id,
            'comment' => null,
        ]);
    }

    public function test_comment_with_html_tags_and_repeated_newlines_is_sanitized(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $token = $client->createToken('client')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/v1/requests/{$req->id}/review", [
                'rating' => 5,
                'comment' => "  <script>alert('x')</script><b>Buen servicio</b>\r\n\r\n\r\nRecomendado.  ",
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.comment', "alert('x')Buen servicio\nRecomendado.");
    }

    public function test_whitespace_only_comment_is_stored_as_null(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $token = $client->createToken('client')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/v1/requests/{$req->id}/review", [
                'rating' => 4,
                'comment' => "    \n\n   ",
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.comment', null);

        $this->assertDatabaseHas('reviews', [
            'service_request_id' => $req->id,
            'comment' => null,
        ]);
    }

    public function test_cannot_review_request_in_pending_status_returns_409(): void
    {
        $this->assertNonCompletedStatusReturns409(ServiceRequestStatus::Pending);
    }

    public function test_cannot_review_request_in_accepted_status_returns_409(): void
    {
        $this->assertNonCompletedStatusReturns409(ServiceRequestStatus::Accepted);
    }

    public function test_cannot_review_request_in_in_progress_status_returns_409(): void
    {
        $this->assertNonCompletedStatusReturns409(ServiceRequestStatus::InProgress);
    }

    public function test_cannot_review_request_in_rejected_status_returns_409(): void
    {
        $this->assertNonCompletedStatusReturns409(ServiceRequestStatus::Rejected);
    }

    public function test_cannot_review_request_in_cancelled_status_returns_409(): void
    {
        $this->assertNonCompletedStatusReturns409(ServiceRequestStatus::Cancelled);
    }

    public function test_cannot_review_request_in_expired_status_returns_409(): void
    {
        $this->assertNonCompletedStatusReturns409(ServiceRequestStatus::Expired);
    }

    private function assertNonCompletedStatusReturns409(ServiceRequestStatus $status): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, $status);
        $token = $client->createToken('client')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/v1/requests/{$req->id}/review", ['rating' => 5])
            ->assertStatus(409)
            ->assertJsonPath('message', 'Solo se puede calificar un servicio completado');
    }

    public function test_other_client_cannot_review_request_and_receives_404(): void
    {
        $tech = $this->createReadyTechnician();
        $owner = $this->createClient('Ana Pérez', 'owner@fixora.test');
        $otherClient = $this->createClient('Luis Gómez', 'other@fixora.test');
        $req = $this->createRequestWithStatus($owner, $tech, ServiceRequestStatus::Completed);

        $token = $otherClient->createToken('other')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/v1/requests/{$req->id}/review", ['rating' => 5])
            ->assertStatus(404);
    }

    public function test_technician_cannot_create_review_and_receives_403(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);

        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        $this->withToken($techToken)
            ->postJson("/api/v1/requests/{$req->id}/review", ['rating' => 5])
            ->assertStatus(403);
    }

    public function test_second_review_for_same_request_returns_409(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $token = $client->createToken('client')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/v1/requests/{$req->id}/review", ['rating' => 5])
            ->assertStatus(201);

        $this->withToken($token)
            ->postJson("/api/v1/requests/{$req->id}/review", ['rating' => 4])
            ->assertStatus(409);
    }

    public function test_database_unique_constraint_violation_is_converted_to_409(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $token = $client->createToken('client')->plainTextToken;

        $injected = false;
        Review::creating(static function (Review $review) use (&$injected): void {
            if ($injected) {
                return;
            }
            $injected = true;

            DB::table('reviews')->insert([
                'service_request_id' => $review->service_request_id,
                'client_id' => $review->client_id,
                'technician_profile_id' => $review->technician_profile_id,
                'rating' => 5,
                'comment' => 'Inserción concurrente',
                'is_hidden' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        try {
            $this->withToken($token)
                ->postJson("/api/v1/requests/{$req->id}/review", ['rating' => 4])
                ->assertStatus(409);
        } finally {
            Review::flushEventListeners();
        }
    }

    public function test_review_cannot_be_updated_or_deleted_via_api(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $review = Review::factory()->create([
            'service_request_id' => $req->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
        ]);

        $token = $client->createToken('client')->plainTextToken;

        $putStatus = $this->withToken($token)->putJson("/api/v1/reviews/{$review->id}", ['rating' => 1])->getStatusCode();
        $patchStatus = $this->withToken($token)->patchJson("/api/v1/reviews/{$review->id}", ['rating' => 1])->getStatusCode();
        $deleteStatus = $this->withToken($token)->deleteJson("/api/v1/reviews/{$review->id}")->getStatusCode();

        $this->assertContains($putStatus, [404, 405]);
        $this->assertContains($patchStatus, [404, 405]);
        $this->assertContains($deleteStatus, [404, 405]);
    }

    public function test_rate_limit_of_20_review_actions_per_hour_per_user(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $token = $client->createToken('client')->plainTextToken;

        for ($i = 0; $i < 20; $i++) {
            $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
            $this->withToken($token)
                ->postJson("/api/v1/requests/{$req->id}/review", ['rating' => 5])
                ->assertStatus(201);
        }

        $extraReq = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $this->withToken($token)
            ->postJson("/api/v1/requests/{$extraReq->id}/review", ['rating' => 5])
            ->assertStatus(429);
    }

    // -------------------------------------------------------------------------
    // CÁLCULO DE CALIFICACIÓN
    // -------------------------------------------------------------------------

    public function test_rating_average_with_5_4_and_3_is_4_00_and_count_3(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $token = $client->createToken('client')->plainTextToken;

        foreach ([5, 4, 3] as $rating) {
            $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
            $this->withToken($token)
                ->postJson("/api/v1/requests/{$req->id}/review", ['rating' => $rating])
                ->assertStatus(201);
        }

        $profile = $tech['profile']->fresh();
        $this->assertSame('4.00', number_format((float) $profile->rating_avg, 2, '.', ''));
        $this->assertSame(3, (int) $profile->rating_count);
    }

    public function test_rating_average_with_5_and_4_is_4_50(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $token = $client->createToken('client')->plainTextToken;

        foreach ([5, 4] as $rating) {
            $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
            $this->withToken($token)
                ->postJson("/api/v1/requests/{$req->id}/review", ['rating' => $rating])
                ->assertStatus(201);
        }

        $profile = $tech['profile']->fresh();
        $this->assertSame('4.50', number_format((float) $profile->rating_avg, 2, '.', ''));
        $this->assertSame(2, (int) $profile->rating_count);
    }

    public function test_hidden_review_is_excluded_from_average_count_and_public_list(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();

        $reqVisible = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $reqHidden = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);

        Review::factory()->create([
            'service_request_id' => $reqVisible->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
            'comment' => 'Reseña visible',
            'is_hidden' => false,
        ]);

        Review::factory()->create([
            'service_request_id' => $reqHidden->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 1,
            'comment' => 'Reseña oculta por moderación',
            'is_hidden' => true,
        ]);

        app(ReviewService::class)->recalculateForTechnician($tech['profile']);

        $profile = $tech['profile']->fresh();
        $this->assertSame('5.00', number_format((float) $profile->rating_avg, 2, '.', ''));
        $this->assertSame(1, (int) $profile->rating_count);

        $this->getJson("/api/v1/technicians/{$profile->id}/reviews")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.comment', 'Reseña visible')
            ->assertJsonPath('summary.rating_avg', '5.00')
            ->assertJsonPath('summary.rating_count', 1)
            ->assertJsonPath('summary.distribution.1', 0)
            ->assertJsonPath('summary.distribution.5', 1);
    }

    public function test_rating_average_without_reviews_is_0_00(): void
    {
        $tech = $this->createReadyTechnician();
        $tech['profile']->update(['rating_avg' => 4.75, 'rating_count' => 8]);

        $result = app(ReviewService::class)->recalculateForTechnician($tech['profile']);

        $this->assertSame(['rating_avg' => '0.00', 'rating_count' => 0], $result);
        $profile = $tech['profile']->fresh();
        $this->assertSame('0.00', number_format((float) $profile->rating_avg, 2, '.', ''));
        $this->assertSame(0, (int) $profile->rating_count);
    }

    public function test_rating_recalculation_is_atomic_with_review_creation(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $token = $client->createToken('client')->plainTextToken;

        Review::created(static function (): void {
            throw new RuntimeException('Fallo simulado tras insertar reseña');
        });

        try {
            $this->withoutExceptionHandling();
            $this->expectException(RuntimeException::class);
            $this->withToken($token)
                ->postJson("/api/v1/requests/{$req->id}/review", ['rating' => 5]);
        } finally {
            Review::flushEventListeners();
        }

        $this->assertDatabaseCount('reviews', 0);
        $profile = $tech['profile']->fresh();
        $this->assertSame('0.00', number_format((float) $profile->rating_avg, 2, '.', ''));
        $this->assertSame(0, (int) $profile->rating_count);
    }

    // -------------------------------------------------------------------------
    // RESPUESTA DEL TÉCNICO
    // -------------------------------------------------------------------------

    public function test_owner_technician_can_reply_to_review(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $review = Review::factory()->create([
            'service_request_id' => $req->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
            'comment' => 'Gran trabajo.',
        ]);

        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        $this->withToken($techToken)
            ->postJson("/api/v1/reviews/{$review->id}/reply", [
                'body' => '  <p>Muchas gracias por su preferencia.</p>  ',
            ])
            ->assertOk()
            ->assertJsonPath('data.technician_reply', 'Muchas gracias por su preferencia.');

        $fresh = $review->fresh();
        $this->assertSame('Muchas gracias por su preferencia.', $fresh->technician_reply);
        $this->assertNotNull($fresh->replied_at);
    }

    public function test_other_technician_cannot_reply_and_receives_404(): void
    {
        $techOwner = $this->createReadyTechnician('Tech A', 'techa@fixora.test');
        $techIntruder = $this->createReadyTechnician('Tech B', 'techb@fixora.test');
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $techOwner, ServiceRequestStatus::Completed);
        $review = Review::factory()->create([
            'service_request_id' => $req->id,
            'client_id' => $client->id,
            'technician_profile_id' => $techOwner['profile']->id,
            'rating' => 5,
        ]);

        $intruderToken = $techIntruder['user']->createToken('intruder')->plainTextToken;

        $this->withToken($intruderToken)
            ->postJson("/api/v1/reviews/{$review->id}/reply", ['body' => 'Respuesta no autorizada'])
            ->assertStatus(404);
    }

    public function test_client_cannot_reply_to_review_and_receives_403(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $review = Review::factory()->create([
            'service_request_id' => $req->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
        ]);

        $clientToken = $client->createToken('client')->plainTextToken;

        $this->withToken($clientToken)
            ->postJson("/api/v1/reviews/{$review->id}/reply", ['body' => 'Intento de cliente'])
            ->assertStatus(403);
    }

    public function test_second_reply_to_same_review_returns_409(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $review = Review::factory()->create([
            'service_request_id' => $req->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
        ]);

        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        $this->withToken($techToken)
            ->postJson("/api/v1/reviews/{$review->id}/reply", ['body' => 'Primera respuesta'])
            ->assertOk();

        $this->withToken($techToken)
            ->postJson("/api/v1/reviews/{$review->id}/reply", ['body' => 'Segunda respuesta'])
            ->assertStatus(409);
    }

    public function test_empty_or_over_1000_char_reply_fails_with_422(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $review = Review::factory()->create([
            'service_request_id' => $req->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
        ]);

        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        $this->withToken($techToken)
            ->postJson("/api/v1/reviews/{$review->id}/reply", ['body' => ''])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['body']);

        $this->withToken($techToken)
            ->postJson("/api/v1/reviews/{$review->id}/reply", ['body' => '   '])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['body']);

        $this->withToken($techToken)
            ->postJson("/api/v1/reviews/{$review->id}/reply", ['body' => '<b>   </b>'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['body']);

        $this->withToken($techToken)
            ->postJson("/api/v1/reviews/{$review->id}/reply", ['body' => str_repeat('x', 1001)])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['body']);
    }

    public function test_replying_to_hidden_review_returns_404(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $hiddenReview = Review::factory()->create([
            'service_request_id' => $req->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 1,
            'is_hidden' => true,
        ]);

        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        $this->withToken($techToken)
            ->postJson("/api/v1/reviews/{$hiddenReview->id}/reply", ['body' => 'Respuesta a oculta'])
            ->assertStatus(404);
    }

    public function test_technician_reply_appears_in_public_reviews_endpoint(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $review = Review::factory()->create([
            'service_request_id' => $req->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
            'comment' => 'Excelente.',
        ]);

        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        $this->withToken($techToken)
            ->postJson("/api/v1/reviews/{$review->id}/reply", ['body' => 'Quedo a sus órdenes.'])
            ->assertOk();

        $this->getJson("/api/v1/technicians/{$tech['profile']->id}/reviews")
            ->assertOk()
            ->assertJsonPath('data.0.technician_reply', 'Quedo a sus órdenes.')
            ->assertJsonPath('data.0.replied_at', $review->fresh()->replied_at->toIso8601String());
    }

    // -------------------------------------------------------------------------
    // CONSULTA PÚBLICA
    // -------------------------------------------------------------------------

    public function test_public_reviews_pagination_and_max_per_page(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();

        for ($i = 0; $i < 26; $i++) {
            $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
            Review::factory()->create([
                'service_request_id' => $req->id,
                'client_id' => $client->id,
                'technician_profile_id' => $tech['profile']->id,
                'rating' => 5,
            ]);
        }

        // Por defecto per_page = 10
        $this->getJson("/api/v1/technicians/{$tech['profile']->id}/reviews")
            ->assertOk()
            ->assertJsonCount(10, 'data')
            ->assertJsonPath('meta.per_page', 10)
            ->assertJsonPath('meta.total', 26);

        // Solicitar per_page = 50 aplica el máximo de 24
        $this->getJson("/api/v1/technicians/{$tech['profile']->id}/reviews?per_page=50")
            ->assertOk()
            ->assertJsonCount(24, 'data')
            ->assertJsonPath('meta.per_page', 24);
    }

    public function test_public_reviews_sorting_recent_highest_and_lowest(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();

        $this->setLocalTestNow('2026-11-18 10:00:00');
        $r1 = Review::factory()->create([
            'service_request_id' => $this->createRequestWithStatus($client, $tech)->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 3,
            'created_at' => Carbon::now('UTC'),
        ]);

        $this->setLocalTestNow('2026-11-18 11:00:00');
        $r2 = Review::factory()->create([
            'service_request_id' => $this->createRequestWithStatus($client, $tech)->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
            'created_at' => Carbon::now('UTC'),
        ]);

        $this->setLocalTestNow('2026-11-18 12:00:00');
        $r3 = Review::factory()->create([
            'service_request_id' => $this->createRequestWithStatus($client, $tech)->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 2,
            'created_at' => Carbon::now('UTC'),
        ]);

        // recent (por defecto): r3, r2, r1
        $this->getJson("/api/v1/technicians/{$tech['profile']->id}/reviews?sort=recent")
            ->assertOk()
            ->assertJsonPath('data.0.id', $r3->id)
            ->assertJsonPath('data.1.id', $r2->id)
            ->assertJsonPath('data.2.id', $r1->id);

        // highest: r2 (5), r1 (3), r3 (2)
        $this->getJson("/api/v1/technicians/{$tech['profile']->id}/reviews?sort=highest")
            ->assertOk()
            ->assertJsonPath('data.0.id', $r2->id)
            ->assertJsonPath('data.1.id', $r1->id)
            ->assertJsonPath('data.2.id', $r3->id);

        // lowest: r3 (2), r1 (3), r2 (5)
        $this->getJson("/api/v1/technicians/{$tech['profile']->id}/reviews?sort=lowest")
            ->assertOk()
            ->assertJsonPath('data.0.id', $r3->id)
            ->assertJsonPath('data.1.id', $r1->id)
            ->assertJsonPath('data.2.id', $r2->id);
    }

    public function test_public_reviews_filter_by_rating(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();

        Review::factory()->create([
            'service_request_id' => $this->createRequestWithStatus($client, $tech)->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
            'comment' => 'Cinco estrellas',
        ]);

        Review::factory()->create([
            'service_request_id' => $this->createRequestWithStatus($client, $tech)->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 2,
            'comment' => 'Dos estrellas',
        ]);

        $this->getJson("/api/v1/technicians/{$tech['profile']->id}/reviews?rating=2")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.comment', 'Dos estrellas');
    }

    public function test_public_reviews_abbreviates_client_name_including_single_word_names(): void
    {
        $tech = $this->createReadyTechnician();
        $clientFull = $this->createClient('Ana Pérez', 'ana.p@fixora.test');
        $clientSingle = $this->createClient('Madonna', 'madonna@fixora.test');

        $r1 = Review::factory()->create([
            'service_request_id' => $this->createRequestWithStatus($clientFull, $tech)->id,
            'client_id' => $clientFull->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
        ]);

        $r2 = Review::factory()->create([
            'service_request_id' => $this->createRequestWithStatus($clientSingle, $tech)->id,
            'client_id' => $clientSingle->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
        ]);

        $this->getJson("/api/v1/technicians/{$tech['profile']->id}/reviews")
            ->assertOk()
            ->assertJsonPath('data.0.id', $r2->id)
            ->assertJsonPath('data.0.client_name', 'Madonna')
            ->assertJsonPath('data.1.id', $r1->id)
            ->assertJsonPath('data.1.client_name', 'Ana P.');
    }

    public function test_public_reviews_never_exposes_sensitive_or_request_details(): void
    {
        $tech = $this->createReadyTechnician(email: 'privado.tech@fixora.test', phone: '9389991111');
        $client = $this->createClient('Ana Pérez', 'privado.client@fixora.test', '9389992222');
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);

        Review::factory()->create([
            'service_request_id' => $req->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
            'comment' => 'Todo perfecto.',
        ]);

        $response = $this->getJson("/api/v1/technicians/{$tech['profile']->id}/reviews")
            ->assertOk()
            ->assertJsonMissingPath('data.0.client_id')
            ->assertJsonMissingPath('data.0.user_id')
            ->assertJsonMissingPath('data.0.service_request_id')
            ->assertJsonMissingPath('data.0.email')
            ->assertJsonMissingPath('data.0.phone')
            ->assertJsonMissingPath('data.0.title')
            ->assertJsonMissingPath('data.0.description')
            ->assertJsonMissingPath('data.0.address_line')
            ->assertJsonMissingPath('data.0.latitude')
            ->assertJsonMissingPath('data.0.longitude');

        $rawBody = (string) $response->getContent();
        $this->assertStringNotContainsString('privado.client@fixora.test', $rawBody);
        $this->assertStringNotContainsString('privado.tech@fixora.test', $rawBody);
        $this->assertStringNotContainsString('9389992222', $rawBody);
        $this->assertStringNotContainsString('9389991111', $rawBody);
        $this->assertStringNotContainsString('Revisión confidencial de circuito', $rawBody);
        $this->assertStringNotContainsString('Descripción detallada confidencial del predio.', $rawBody);
        $this->assertStringNotContainsString('Calle Secreta 999, Col. Petrolera', $rawBody);
        $this->assertStringNotContainsString('18.6451234', $rawBody);
        $this->assertStringNotContainsString('-91.8219876', $rawBody);
    }

    public function test_public_reviews_for_hidden_or_suspended_technician_returns_404(): void
    {
        $hiddenTech = $this->createReadyTechnician('Oculto', 'oculto@fixora.test');
        $hiddenTech['profile']->update(['is_visible' => false]);

        $this->getJson("/api/v1/technicians/{$hiddenTech['profile']->id}/reviews")
            ->assertStatus(404);

        $suspendedTech = $this->createReadyTechnician('Suspendido', 'suspendido@fixora.test');
        $suspendedTech['user']->update(['status' => UserStatus::Suspended]);

        $this->getJson("/api/v1/technicians/{$suspendedTech['profile']->id}/reviews")
            ->assertStatus(404);
    }

    public function test_public_reviews_returns_complete_distribution_with_zeros(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();

        foreach ([5, 5, 3] as $rating) {
            Review::factory()->create([
                'service_request_id' => $this->createRequestWithStatus($client, $tech)->id,
                'client_id' => $client->id,
                'technician_profile_id' => $tech['profile']->id,
                'rating' => $rating,
            ]);
        }

        Review::factory()->create([
            'service_request_id' => $this->createRequestWithStatus($client, $tech)->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 1,
            'is_hidden' => true,
        ]);

        $this->getJson("/api/v1/technicians/{$tech['profile']->id}/reviews")
            ->assertOk()
            ->assertJsonPath('summary.rating_avg', '4.33')
            ->assertJsonPath('summary.rating_count', 3)
            ->assertJsonPath('summary.distribution.1', 0)
            ->assertJsonPath('summary.distribution.2', 0)
            ->assertJsonPath('summary.distribution.3', 1)
            ->assertJsonPath('summary.distribution.4', 0)
            ->assertJsonPath('summary.distribution.5', 2);
    }

    public function test_public_reviews_without_reviews_returns_200_and_empty_list(): void
    {
        $tech = $this->createReadyTechnician();

        $this->getJson("/api/v1/technicians/{$tech['profile']->id}/reviews")
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('summary.rating_avg', '0.00')
            ->assertJsonPath('summary.rating_count', 0)
            ->assertJsonPath('summary.distribution.1', 0)
            ->assertJsonPath('summary.distribution.2', 0)
            ->assertJsonPath('summary.distribution.3', 0)
            ->assertJsonPath('summary.distribution.4', 0)
            ->assertJsonPath('summary.distribution.5', 0);
    }

    // -------------------------------------------------------------------------
    // LISTA DEL TÉCNICO
    // -------------------------------------------------------------------------

    public function test_technician_reviews_list_returns_only_own_reviews_including_hidden_flag(): void
    {
        $techA = $this->createReadyTechnician('Tech A', 'techa@fixora.test');
        $techB = $this->createReadyTechnician('Tech B', 'techb@fixora.test');
        $client = $this->createClient('Ana Pérez', 'ana@fixora.test', '9387778899');

        $visibleA = Review::factory()->create([
            'service_request_id' => $this->createRequestWithStatus($client, $techA)->id,
            'client_id' => $client->id,
            'technician_profile_id' => $techA['profile']->id,
            'rating' => 5,
            'is_hidden' => false,
        ]);

        $hiddenA = Review::factory()->create([
            'service_request_id' => $this->createRequestWithStatus($client, $techA)->id,
            'client_id' => $client->id,
            'technician_profile_id' => $techA['profile']->id,
            'rating' => 1,
            'is_hidden' => true,
        ]);

        Review::factory()->create([
            'service_request_id' => $this->createRequestWithStatus($client, $techB)->id,
            'client_id' => $client->id,
            'technician_profile_id' => $techB['profile']->id,
            'rating' => 4,
        ]);

        $tokenA = $techA['user']->createToken('tech-a')->plainTextToken;

        $response = $this->withToken($tokenA)
            ->getJson('/api/v1/technician/reviews')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $hiddenA->id)
            ->assertJsonPath('data.0.is_hidden', true)
            ->assertJsonPath('data.0.client_name', 'Ana P.')
            ->assertJsonPath('data.1.id', $visibleA->id)
            ->assertJsonPath('data.1.is_hidden', false);

        $this->assertStringNotContainsString('ana@fixora.test', (string) $response->getContent());
        $this->assertStringNotContainsString('9387778899', (string) $response->getContent());
    }

    public function test_technician_reviews_list_filters_by_pending_reply(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();

        $unreplied = Review::factory()->create([
            'service_request_id' => $this->createRequestWithStatus($client, $tech)->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
            'technician_reply' => null,
        ]);

        $replied = Review::factory()->create([
            'service_request_id' => $this->createRequestWithStatus($client, $tech)->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 4,
            'technician_reply' => 'Gracias.',
            'replied_at' => now(),
        ]);

        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        $this->withToken($techToken)
            ->getJson('/api/v1/technician/reviews?pending_reply=true')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $unreplied->id);

        $this->withToken($techToken)
            ->getJson('/api/v1/technician/reviews?pending_reply=false')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $replied->id);
    }

    public function test_client_cannot_access_technician_reviews_list_returns_403(): void
    {
        $client = $this->createClient();
        $clientToken = $client->createToken('client')->plainTextToken;

        $this->withToken($clientToken)
            ->getJson('/api/v1/technician/reviews')
            ->assertStatus(403);
    }

    // -------------------------------------------------------------------------
    // INTEGRACIÓN CON SOLICITUD (B4)
    // -------------------------------------------------------------------------

    public function test_service_request_can_review_is_true_only_for_owner_client_when_completed_without_review(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $clientToken = $client->createToken('client')->plainTextToken;
        $techToken = $tech['user']->createToken('tech')->plainTextToken;

        // En pending -> false
        $pendingReq = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Pending);
        $this->app['auth']->forgetGuards();
        $this->withToken($clientToken)->getJson("/api/v1/requests/{$pendingReq->id}")
            ->assertOk()
            ->assertJsonPath('data.can_review', false)
            ->assertJsonPath('data.review', null);

        // En completed sin reseña -> true para el cliente dueño, false para el técnico
        $completedReq = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $this->app['auth']->forgetGuards();
        $this->withToken($clientToken)->getJson("/api/v1/requests/{$completedReq->id}")
            ->assertOk()
            ->assertJsonPath('data.can_review', true)
            ->assertJsonPath('data.review', null);

        $this->app['auth']->forgetGuards();
        $this->withToken($techToken)->getJson("/api/v1/requests/{$completedReq->id}")
            ->assertOk()
            ->assertJsonPath('data.can_review', false);

        // Tras crear la reseña -> can_review pasa a false
        $this->app['auth']->forgetGuards();
        $this->withToken($clientToken)->postJson("/api/v1/requests/{$completedReq->id}/review", ['rating' => 5])
            ->assertStatus(201);

        $this->app['auth']->forgetGuards();
        $this->withToken($clientToken)->getJson("/api/v1/requests/{$completedReq->id}")
            ->assertOk()
            ->assertJsonPath('data.can_review', false);
    }

    public function test_service_request_detail_includes_review_when_present(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $review = Review::factory()->create([
            'service_request_id' => $req->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
            'comment' => 'Trabajo impecable.',
            'technician_reply' => 'Muchas gracias.',
        ]);

        $clientToken = $client->createToken('client')->plainTextToken;

        $this->withToken($clientToken)->getJson("/api/v1/requests/{$req->id}")
            ->assertOk()
            ->assertJsonPath('data.can_review', false)
            ->assertJsonPath('data.review.rating', 5)
            ->assertJsonPath('data.review.comment', 'Trabajo impecable.')
            ->assertJsonPath('data.review.technician_reply', 'Muchas gracias.')
            ->assertJsonPath('data.review.created_at', $review->created_at->toIso8601String());
    }

    // -------------------------------------------------------------------------
    // COMANDO ARTISAN fixora:recalculate-ratings
    // -------------------------------------------------------------------------

    public function test_recalculate_command_fixes_altered_rating_avg_and_completed_count(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();

        $req1 = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);
        $req2 = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);

        Review::factory()->create([
            'service_request_id' => $req1->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
        ]);

        Review::factory()->create([
            'service_request_id' => $req2->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 4,
        ]);

        $tech['profile']->forceFill([
            'rating_avg' => 1.23,
            'rating_count' => 99,
            'completed_count' => 77,
        ])->save();

        $this->artisan('fixora:recalculate-ratings')->assertExitCode(0);

        $fresh = $tech['profile']->fresh();
        $this->assertSame('4.50', number_format((float) $fresh->rating_avg, 2, '.', ''));
        $this->assertSame(2, (int) $fresh->rating_count);
        $this->assertSame(2, (int) $fresh->completed_count);
    }

    public function test_recalculate_command_dry_run_reports_without_modifying_database(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);

        Review::factory()->create([
            'service_request_id' => $req->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
        ]);

        $tech['profile']->forceFill([
            'rating_avg' => 2.00,
            'rating_count' => 10,
            'completed_count' => 50,
        ])->save();

        $this->artisan('fixora:recalculate-ratings --dry-run')->assertExitCode(0);

        $fresh = $tech['profile']->fresh();
        $this->assertSame('2.00', number_format((float) $fresh->rating_avg, 2, '.', ''));
        $this->assertSame(10, (int) $fresh->rating_count);
        $this->assertSame(50, (int) $fresh->completed_count);
    }

    public function test_recalculate_command_technician_option_limits_scope(): void
    {
        $techA = $this->createReadyTechnician('Tech A', 'techa@fixora.test');
        $techB = $this->createReadyTechnician('Tech B', 'techb@fixora.test');
        $client = $this->createClient();

        $reqA = $this->createRequestWithStatus($client, $techA, ServiceRequestStatus::Completed);
        $reqB = $this->createRequestWithStatus($client, $techB, ServiceRequestStatus::Completed);

        Review::factory()->create([
            'service_request_id' => $reqA->id,
            'client_id' => $client->id,
            'technician_profile_id' => $techA['profile']->id,
            'rating' => 5,
        ]);

        Review::factory()->create([
            'service_request_id' => $reqB->id,
            'client_id' => $client->id,
            'technician_profile_id' => $techB['profile']->id,
            'rating' => 5,
        ]);

        $techA['profile']->forceFill(['rating_avg' => 1.00, 'rating_count' => 0, 'completed_count' => 0])->save();
        $techB['profile']->forceFill(['rating_avg' => 1.00, 'rating_count' => 0, 'completed_count' => 0])->save();

        $this->artisan("fixora:recalculate-ratings --technician={$techA['profile']->id}")
            ->assertExitCode(0);

        $freshA = $techA['profile']->fresh();
        $freshB = $techB['profile']->fresh();

        $this->assertSame('5.00', number_format((float) $freshA->rating_avg, 2, '.', ''));
        $this->assertSame(1, (int) $freshA->rating_count);
        $this->assertSame(1, (int) $freshA->completed_count);

        $this->assertSame('1.00', number_format((float) $freshB->rating_avg, 2, '.', ''));
        $this->assertSame(0, (int) $freshB->rating_count);
        $this->assertSame(0, (int) $freshB->completed_count);
    }

    public function test_recalculate_command_is_idempotent(): void
    {
        $tech = $this->createReadyTechnician();
        $client = $this->createClient();
        $req = $this->createRequestWithStatus($client, $tech, ServiceRequestStatus::Completed);

        Review::factory()->create([
            'service_request_id' => $req->id,
            'client_id' => $client->id,
            'technician_profile_id' => $tech['profile']->id,
            'rating' => 5,
        ]);

        $tech['profile']->forceFill(['rating_avg' => 1.50, 'rating_count' => 4, 'completed_count' => 9])->save();

        $this->artisan('fixora:recalculate-ratings')->assertExitCode(0);
        $afterFirst = $tech['profile']->fresh()->toArray();

        $this->artisan('fixora:recalculate-ratings')->assertExitCode(0);
        $afterSecond = $tech['profile']->fresh()->toArray();

        $this->assertSame($afterFirst['rating_avg'], $afterSecond['rating_avg']);
        $this->assertSame($afterFirst['rating_count'], $afterSecond['rating_count']);
        $this->assertSame($afterFirst['completed_count'], $afterSecond['completed_count']);
    }
}