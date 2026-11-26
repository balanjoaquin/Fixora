<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\ServiceRequestStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Events\ServiceRequestStatusChanged;
use App\Models\AvailabilitySlot;
use App\Models\RequestEvent;
use App\Models\ServiceRequest;
use App\Models\TechnicianProfile;
use App\Models\TechnicianService;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ServiceRequestService
{
    /**
     * Lista paginada de solicitudes propias del usuario autenticado (cliente o técnico).
     *
     * @param array{status?: string|null, per_page?: int|string|null} $filters
     */
    public function listForUser(User $user, array $filters = []): LengthAwarePaginator
    {
        $query = ServiceRequest::query()
            ->with([
                'client:id,name,phone',
                'technicianProfile.user:id,name,phone',
                'specialty:id,name,slug',
                'technicianService:id,title,reference_price',
                'review:id,service_request_id,rating,comment,technician_reply,created_at',
                'events' => static fn ($q) => $q->orderBy('id'),
            ]);

        if ($user->role === UserRole::Client) {
            $query->where('client_id', $user->id);
        } elseif ($user->role === UserRole::Technician) {
            $profileId = $user->technicianProfile?->id ?? 0;
            $query->where('technician_profile_id', $profileId);
        } else {
            $query->whereRaw('1 = 0');
        }

        if (!empty($filters['status'])) {
            $statuses = array_values(array_filter(array_map(
                static fn (string $s): string => trim($s),
                explode(',', (string) $filters['status'])
            )));

            if ($statuses !== []) {
                $query->whereIn('status', $statuses);
            }
        }

        $perPage = min(max((int) ($filters['per_page'] ?? 12), 1), 24);

        return $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);
    }

    /**
     * Crea una solicitud de servicio dirigida a un técnico visible y activo.
     *
     * @param array<string, mixed> $data
     */
    public function create(User $client, array $data): ServiceRequest
    {
        /** @var TechnicianProfile|null $profile */
        $profile = TechnicianProfile::query()
            ->with('user')
            ->whereKey((int) $data['technician_profile_id'])
            ->first();

        if (
            $profile === null
            || !$profile->is_visible
            || $profile->user === null
            || $profile->user->status !== UserStatus::Active
            || $profile->user->role !== UserRole::Technician
        ) {
            throw (new ModelNotFoundException())->setModel(TechnicianProfile::class, [(int) $data['technician_profile_id']]);
        }

        $specialtyId = (int) $data['specialty_id'];
        $hasSpecialty = $profile->specialties()
            ->where('specialties.id', $specialtyId)
            ->where('specialties.is_active', true)
            ->exists();

        if (!$hasSpecialty) {
            throw ValidationException::withMessages([
                'specialty_id' => ['El técnico seleccionado no ofrece esta especialidad.'],
            ]);
        }

        $serviceId = isset($data['technician_service_id']) && $data['technician_service_id'] !== null
            ? (int) $data['technician_service_id']
            : null;

        if ($serviceId !== null) {
            /** @var TechnicianService|null $service */
            $service = TechnicianService::query()
                ->whereKey($serviceId)
                ->where('technician_profile_id', $profile->id)
                ->where('is_active', true)
                ->first();

            if ($service === null) {
                throw ValidationException::withMessages([
                    'technician_service_id' => ['El servicio seleccionado no pertenece al técnico o no está disponible.'],
                ]);
            }

            if ((int) $service->specialty_id !== $specialtyId) {
                throw ValidationException::withMessages([
                    'technician_service_id' => ['El servicio seleccionado no corresponde a la especialidad indicada.'],
                ]);
            }
        }

        $timezone = (string) config('fixora.timezone', 'America/Mexico_City');
        $nowLocal = Carbon::now($timezone);
        $todayLocal = $nowLocal->copy()->startOfDay();
        $maxDaysAhead = (int) config('fixora.max_days_ahead', 60);
        $maxDateLocal = $todayLocal->copy()->addDays($maxDaysAhead);

        $preferredDateStr = (string) $data['preferred_date'];
        $preferredStartStr = (string) $data['preferred_start'];

        $preferredDateLocal = Carbon::createFromFormat('Y-m-d', $preferredDateStr, $timezone)->startOfDay();

        if ($preferredDateLocal->lt($todayLocal)) {
            throw ValidationException::withMessages([
                'preferred_date' => ['La fecha solicitada debe ser hoy o una fecha futura.'],
            ]);
        }

        if ($preferredDateLocal->gt($maxDateLocal)) {
            throw ValidationException::withMessages([
                'preferred_date' => ["La fecha solicitada no puede superar {$maxDaysAhead} días adelante."],
            ]);
        }

        $preferredMomentLocal = Carbon::createFromFormat(
            'Y-m-d H:i',
            "{$preferredDateStr} {$preferredStartStr}",
            $timezone
        );

        if ($preferredMomentLocal->lte($nowLocal)) {
            throw ValidationException::withMessages([
                'preferred_start' => ['La fecha y hora solicitadas deben ser posteriores al momento actual.'],
            ]);
        }

        $weekday = $preferredDateLocal->dayOfWeekIso;
        $localTimeWithSeconds = strlen($preferredStartStr) === 5
            ? $preferredStartStr . ':00'
            : $preferredStartStr;

        $withinAvailability = AvailabilitySlot::query()
            ->where('technician_profile_id', $profile->id)
            ->where('weekday', $weekday)
            ->where('start_time', '<=', $localTimeWithSeconds)
            ->where('end_time', '>', $localTimeWithSeconds)
            ->exists();

        if (!$withinAvailability) {
            throw ValidationException::withMessages([
                'preferred_start' => ['La hora solicitada está fuera de la disponibilidad semanal del técnico para ese día.'],
            ]);
        }

        $responseHours = (int) config('fixora.request_response_hours', 48);

        return DB::transaction(function () use (
            $client,
            $profile,
            $specialtyId,
            $serviceId,
            $data,
            $preferredDateStr,
            $localTimeWithSeconds,
            $responseHours
        ): ServiceRequest {
            $nowUtc = Carbon::now('UTC');
            $expiresAtUtc = $nowUtc->copy()->addHours($responseHours);

            /** @var ServiceRequest $serviceRequest */
            $serviceRequest = ServiceRequest::query()->create([
                'client_id' => $client->id,
                'technician_profile_id' => $profile->id,
                'specialty_id' => $specialtyId,
                'technician_service_id' => $serviceId,
                'title' => trim((string) $data['title']),
                'description' => trim((string) $data['description']),
                'address_line' => trim((string) $data['address_line']),
                'approx_zone' => trim((string) $data['approx_zone']),
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
                'preferred_date' => $preferredDateStr,
                'preferred_start' => $localTimeWithSeconds,
                'status' => ServiceRequestStatus::Pending,
                'expires_at' => $expiresAtUtc,
            ]);

            RequestEvent::query()->create([
                'service_request_id' => $serviceRequest->id,
                'from_status' => null,
                'to_status' => ServiceRequestStatus::Pending->value,
                'actor_id' => $client->id,
                'actor_role' => UserRole::Client->value,
                'reason' => null,
                'created_at' => $nowUtc,
            ]);

            $fresh = $serviceRequest->fresh([
                'client:id,name,phone',
                'technicianProfile.user:id,name,phone',
                'specialty:id,name,slug',
                'technicianService:id,title,reference_price',
                'review:id,service_request_id,rating,comment,technician_reply,created_at',
                'events' => static fn ($q) => $q->orderBy('id'),
            ]);

            ServiceRequestStatusChanged::dispatch(
                $fresh,
                null,
                ServiceRequestStatus::Pending,
                $client,
                null
            );

            return $fresh;
        });
    }

    /**
     * Carga las relaciones necesarias para el detalle de una solicitud.
     */
    public function loadDetail(ServiceRequest $serviceRequest): ServiceRequest
    {
        return $serviceRequest->load([
            'client:id,name,phone',
            'technicianProfile.user:id,name,phone',
            'specialty:id,name,slug',
            'technicianService:id,title,reference_price',
            'review:id,service_request_id,rating,comment,technician_reply,created_at',
            'events' => static fn ($q) => $q->orderBy('id'),
        ]);
    }
}