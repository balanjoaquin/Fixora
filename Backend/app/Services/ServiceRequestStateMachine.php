<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\ServiceRequestStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Events\ServiceRequestStatusChanged;
use App\Exceptions\InvalidTransitionException;
use App\Models\RequestEvent;
use App\Models\ServiceRequest;
use App\Models\TechnicianProfile;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ServiceRequestStateMachine
{
    private const DEFAULT_INVALID_MESSAGE = 'La solicitud ya no puede cambiar de ese estado';

    /**
     * pending -> accepted (técnico dueño de la solicitud).
     */
    public function accept(ServiceRequest $serviceRequest, User $actor): ServiceRequest
    {
        return DB::transaction(function () use ($serviceRequest, $actor): ServiceRequest {
            $locked = $this->lockForUpdate($serviceRequest->id);

            $this->assertTechnicianOwner($locked, $actor);

            if ($locked->status !== ServiceRequestStatus::Pending) {
                throw new InvalidTransitionException(self::DEFAULT_INVALID_MESSAGE);
            }

            $hasScheduleConflict = ServiceRequest::query()
                ->where('technician_profile_id', $locked->technician_profile_id)
                ->whereKeyNot($locked->id)
                ->whereIn('status', [
                    ServiceRequestStatus::Accepted->value,
                    ServiceRequestStatus::InProgress->value,
                ])
                ->whereDate('preferred_date', $locked->preferred_date->format('Y-m-d'))
                ->where('preferred_start', $locked->preferred_start)
                ->lockForUpdate()
                ->exists();

            if ($hasScheduleConflict) {
                throw new InvalidTransitionException(
                    'Ya tienes otra solicitud aceptada o en progreso en esa fecha y hora.'
                );
            }

            $nowUtc = Carbon::now('UTC');
            $fromStatus = $locked->status->value;

            $locked->forceFill([
                'status' => ServiceRequestStatus::Accepted,
                'accepted_at' => $nowUtc,
            ])->save();

            $this->insertEvent(
                serviceRequestId: $locked->id,
                fromStatus: $fromStatus,
                toStatus: ServiceRequestStatus::Accepted->value,
                actorId: $actor->id,
                actorRole: UserRole::Technician->value,
                reason: null,
                createdAtUtc: $nowUtc,
            );

            $fresh = $this->loadFreshRelations($locked);

            ServiceRequestStatusChanged::dispatch(
                $fresh,
                $fromStatus,
                ServiceRequestStatus::Accepted,
                $actor,
                null
            );

            return $fresh;
        });
    }

    /**
     * pending -> rejected (técnico dueño, reason obligatoria).
     */
    public function reject(ServiceRequest $serviceRequest, User $actor, string $reason): ServiceRequest
    {
        $cleanReason = trim($reason);
        if ($cleanReason === '') {
            throw ValidationException::withMessages([
                'reason' => ['El motivo de rechazo es obligatorio.'],
            ]);
        }

        return DB::transaction(function () use ($serviceRequest, $actor, $cleanReason): ServiceRequest {
            $locked = $this->lockForUpdate($serviceRequest->id);

            $this->assertTechnicianOwner($locked, $actor);

            if ($locked->status !== ServiceRequestStatus::Pending) {
                throw new InvalidTransitionException(self::DEFAULT_INVALID_MESSAGE);
            }

            $nowUtc = Carbon::now('UTC');
            $fromStatus = $locked->status->value;

            $locked->forceFill([
                'status' => ServiceRequestStatus::Rejected,
                'closed_at' => $nowUtc,
                'closed_by' => $actor->id,
                'closing_reason' => $cleanReason,
            ])->save();

            $this->insertEvent(
                serviceRequestId: $locked->id,
                fromStatus: $fromStatus,
                toStatus: ServiceRequestStatus::Rejected->value,
                actorId: $actor->id,
                actorRole: UserRole::Technician->value,
                reason: $cleanReason,
                createdAtUtc: $nowUtc,
            );

            $fresh = $this->loadFreshRelations($locked);

            ServiceRequestStatusChanged::dispatch(
                $fresh,
                $fromStatus,
                ServiceRequestStatus::Rejected,
                $actor,
                $cleanReason
            );

            return $fresh;
        });
    }

    /**
     * accepted -> in_progress (técnico dueño; fecha local de hoy >= preferred_date).
     */
    public function start(ServiceRequest $serviceRequest, User $actor): ServiceRequest
    {
        return DB::transaction(function () use ($serviceRequest, $actor): ServiceRequest {
            $locked = $this->lockForUpdate($serviceRequest->id);

            $this->assertTechnicianOwner($locked, $actor);

            if ($locked->status !== ServiceRequestStatus::Accepted) {
                throw new InvalidTransitionException(self::DEFAULT_INVALID_MESSAGE);
            }

            $timezone = (string) config('fixora.timezone', 'America/Mexico_City');
            $todayLocal = Carbon::now($timezone)->toDateString();
            $preferredDate = $locked->preferred_date->format('Y-m-d');

            if ($todayLocal < $preferredDate) {
                throw ValidationException::withMessages([
                    'preferred_date' => ['No puedes iniciar el servicio antes de la fecha programada.'],
                ]);
            }

            $nowUtc = Carbon::now('UTC');
            $fromStatus = $locked->status->value;

            $locked->forceFill([
                'status' => ServiceRequestStatus::InProgress,
                'started_at' => $nowUtc,
            ])->save();

            $this->insertEvent(
                serviceRequestId: $locked->id,
                fromStatus: $fromStatus,
                toStatus: ServiceRequestStatus::InProgress->value,
                actorId: $actor->id,
                actorRole: UserRole::Technician->value,
                reason: null,
                createdAtUtc: $nowUtc,
            );

            $fresh = $this->loadFreshRelations($locked);

            ServiceRequestStatusChanged::dispatch(
                $fresh,
                $fromStatus,
                ServiceRequestStatus::InProgress,
                $actor,
                null
            );

            return $fresh;
        });
    }

    /**
     * in_progress -> completed (técnico dueño; incrementa completed_count en la misma transacción).
     */
    public function complete(ServiceRequest $serviceRequest, User $actor): ServiceRequest
    {
        return DB::transaction(function () use ($serviceRequest, $actor): ServiceRequest {
            $locked = $this->lockForUpdate($serviceRequest->id);

            $this->assertTechnicianOwner($locked, $actor);

            if ($locked->status !== ServiceRequestStatus::InProgress) {
                throw new InvalidTransitionException(self::DEFAULT_INVALID_MESSAGE);
            }

            $nowUtc = Carbon::now('UTC');
            $fromStatus = $locked->status->value;

            $locked->forceFill([
                'status' => ServiceRequestStatus::Completed,
                'completed_at' => $nowUtc,
            ])->save();

            /** @var TechnicianProfile $profile */
            $profile = TechnicianProfile::query()
                ->whereKey($locked->technician_profile_id)
                ->lockForUpdate()
                ->firstOrFail();

            $profile->increment('completed_count');

            $this->insertEvent(
                serviceRequestId: $locked->id,
                fromStatus: $fromStatus,
                toStatus: ServiceRequestStatus::Completed->value,
                actorId: $actor->id,
                actorRole: UserRole::Technician->value,
                reason: null,
                createdAtUtc: $nowUtc,
            );

            $fresh = $this->loadFreshRelations($locked);

            ServiceRequestStatusChanged::dispatch(
                $fresh,
                $fromStatus,
                ServiceRequestStatus::Completed,
                $actor,
                null
            );

            return $fresh;
        });
    }

    /**
     * Cancelación.
     */
    public function cancel(ServiceRequest $serviceRequest, User $actor, ?string $reason = null): ServiceRequest
    {
        $cleanReason = $reason !== null ? trim($reason) : null;
        if ($cleanReason === '') {
            $cleanReason = null;
        }

        return DB::transaction(function () use ($serviceRequest, $actor, $cleanReason): ServiceRequest {
            $locked = $this->lockForUpdate($serviceRequest->id);

            $isClientOwner = $actor->role === UserRole::Client
                && (int) $locked->client_id === (int) $actor->id;
            $isTechnicianOwner = $actor->role === UserRole::Technician
                && $actor->technicianProfile !== null
                && (int) $locked->technician_profile_id === (int) $actor->technicianProfile->id;

            if (!$isClientOwner && !$isTechnicianOwner) {
                throw new InvalidTransitionException(self::DEFAULT_INVALID_MESSAGE);
            }

            if ($locked->status === ServiceRequestStatus::Pending) {
                if (!$isClientOwner) {
                    throw new InvalidTransitionException(self::DEFAULT_INVALID_MESSAGE);
                }
            } elseif (in_array($locked->status, [ServiceRequestStatus::Accepted, ServiceRequestStatus::InProgress], true)) {
                if ($cleanReason === null) {
                    throw ValidationException::withMessages([
                        'reason' => ['El motivo de cancelación es obligatorio en este estado.'],
                    ]);
                }
            } else {
                throw new InvalidTransitionException(self::DEFAULT_INVALID_MESSAGE);
            }

            $nowUtc = Carbon::now('UTC');
            $fromStatus = $locked->status->value;
            $actorRole = $isClientOwner ? UserRole::Client->value : UserRole::Technician->value;

            $locked->forceFill([
                'status' => ServiceRequestStatus::Cancelled,
                'closed_at' => $nowUtc,
                'closed_by' => $actor->id,
                'closing_reason' => $cleanReason,
            ])->save();

            $this->insertEvent(
                serviceRequestId: $locked->id,
                fromStatus: $fromStatus,
                toStatus: ServiceRequestStatus::Cancelled->value,
                actorId: $actor->id,
                actorRole: $actorRole,
                reason: $cleanReason,
                createdAtUtc: $nowUtc,
            );

            $fresh = $this->loadFreshRelations($locked);

            ServiceRequestStatusChanged::dispatch(
                $fresh,
                $fromStatus,
                ServiceRequestStatus::Cancelled,
                $actor,
                $cleanReason
            );

            return $fresh;
        });
    }

    /**
     * pending -> expired (sistema, cuando expires_at <= ahora UTC).
     */
    public function expire(ServiceRequest $serviceRequest): ServiceRequest
    {
        return DB::transaction(function () use ($serviceRequest): ServiceRequest {
            $locked = $this->lockForUpdate($serviceRequest->id);

            $nowUtc = Carbon::now('UTC');

            if (
                $locked->status !== ServiceRequestStatus::Pending
                || $locked->expires_at === null
                || $locked->expires_at->gt($nowUtc)
            ) {
                throw new InvalidTransitionException(self::DEFAULT_INVALID_MESSAGE);
            }

            $fromStatus = $locked->status->value;
            $systemReason = 'Solicitud vencida automáticamente por falta de respuesta.';

            $locked->forceFill([
                'status' => ServiceRequestStatus::Expired,
                'closed_at' => $nowUtc,
                'closed_by' => null,
                'closing_reason' => $systemReason,
            ])->save();

            $this->insertEvent(
                serviceRequestId: $locked->id,
                fromStatus: $fromStatus,
                toStatus: ServiceRequestStatus::Expired->value,
                actorId: null,
                actorRole: 'system',
                reason: $systemReason,
                createdAtUtc: $nowUtc,
            );

            $fresh = $this->loadFreshRelations($locked);

            ServiceRequestStatusChanged::dispatch(
                $fresh,
                $fromStatus,
                ServiceRequestStatus::Expired,
                null,
                $systemReason
            );

            return $fresh;
        });
    }

    /**
     * Devuelve las acciones permitidas para el usuario autenticado según su rol y el estado actual.
     *
     * @return array<int, string>
     */
    public function availableActions(User $user, ServiceRequest $serviceRequest): array
    {
        if ($user->status !== UserStatus::Active) {
            return [];
        }

        if ($user->role === UserRole::Client && (int) $serviceRequest->client_id === (int) $user->id) {
            return match ($serviceRequest->status) {
                ServiceRequestStatus::Pending,
                ServiceRequestStatus::Accepted,
                ServiceRequestStatus::InProgress => ['cancel'],
                default => [],
            };
        }

        $profileId = $user->technicianProfile?->id;
        if (
            $user->role === UserRole::Technician
            && $profileId !== null
            && (int) $serviceRequest->technician_profile_id === (int) $profileId
        ) {
            return match ($serviceRequest->status) {
                ServiceRequestStatus::Pending => ['accept', 'reject'],
                ServiceRequestStatus::Accepted => ['start', 'cancel'],
                ServiceRequestStatus::InProgress => ['complete', 'cancel'],
                default => [],
            };
        }

        return [];
    }

    private function lockForUpdate(int $id): ServiceRequest
    {
        return ServiceRequest::query()
            ->whereKey($id)
            ->lockForUpdate()
            ->firstOrFail();
    }

    private function assertTechnicianOwner(ServiceRequest $serviceRequest, User $actor): void
    {
        $profileId = $actor->technicianProfile?->id;

        if (
            $actor->role !== UserRole::Technician
            || $profileId === null
            || (int) $serviceRequest->technician_profile_id !== (int) $profileId
        ) {
            throw new InvalidTransitionException(self::DEFAULT_INVALID_MESSAGE);
        }
    }

    private function insertEvent(
        int $serviceRequestId,
        ?string $fromStatus,
        string $toStatus,
        ?int $actorId,
        string $actorRole,
        ?string $reason,
        Carbon $createdAtUtc,
    ): void {
        RequestEvent::query()->create([
            'service_request_id' => $serviceRequestId,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'actor_id' => $actorId,
            'actor_role' => $actorRole,
            'reason' => $reason,
            'created_at' => $createdAtUtc,
        ]);
    }

    private function loadFreshRelations(ServiceRequest $serviceRequest): ServiceRequest
    {
        return $serviceRequest->fresh([
            'client:id,name,phone',
            'technicianProfile.user:id,name,phone',
            'specialty:id,name,slug',
            'technicianService:id,title,reference_price',
            'review:id,service_request_id,rating,comment,technician_reply,created_at',
            'events' => static fn ($q) => $q->orderBy('id'),
        ]);
    }
}