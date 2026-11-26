<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ServiceRequestPolicy
{
    public function viewAny(User $user): Response
    {
        if ($user->status !== UserStatus::Active) {
            return Response::deny('Tu cuenta no se encuentra activa.');
        }

        if (!in_array($user->role, [UserRole::Client, UserRole::Technician], true)) {
            return Response::deny('No tienes permisos para consultar solicitudes.');
        }

        return Response::allow();
    }

    public function create(User $user): Response
    {
        if ($user->status !== UserStatus::Active || $user->role !== UserRole::Client) {
            return Response::deny('Solo los clientes activos pueden crear solicitudes de servicio.');
        }

        return Response::allow();
    }

    public function view(User $user, ServiceRequest $serviceRequest): Response
    {
        if (!$this->isParticipant($user, $serviceRequest)) {
            return Response::denyAsNotFound();
        }

        return Response::allow();
    }

    public function accept(User $user, ServiceRequest $serviceRequest): Response
    {
        return $this->authorizeTechnicianParticipant($user, $serviceRequest);
    }

    public function reject(User $user, ServiceRequest $serviceRequest): Response
    {
        return $this->authorizeTechnicianParticipant($user, $serviceRequest);
    }

    public function start(User $user, ServiceRequest $serviceRequest): Response
    {
        return $this->authorizeTechnicianParticipant($user, $serviceRequest);
    }

    public function complete(User $user, ServiceRequest $serviceRequest): Response
    {
        return $this->authorizeTechnicianParticipant($user, $serviceRequest);
    }

    public function cancel(User $user, ServiceRequest $serviceRequest): Response
    {
        if (!$this->isParticipant($user, $serviceRequest)) {
            return Response::denyAsNotFound();
        }

        return Response::allow();
    }

    private function authorizeTechnicianParticipant(User $user, ServiceRequest $serviceRequest): Response
    {
        if (!$this->isParticipant($user, $serviceRequest)) {
            return Response::denyAsNotFound();
        }

        if ($user->role !== UserRole::Technician) {
            return Response::deny('Esta acción solo puede ser realizada por el técnico asignado.');
        }

        return Response::allow();
    }

    private function isParticipant(User $user, ServiceRequest $serviceRequest): bool
    {
        if ($user->status !== UserStatus::Active) {
            return false;
        }

        if ($user->role === UserRole::Client) {
            return (int) $serviceRequest->client_id === (int) $user->id;
        }

        if ($user->role === UserRole::Technician) {
            $profileId = $user->technicianProfile?->id;

            return $profileId !== null
                && (int) $serviceRequest->technician_profile_id === (int) $profileId;
        }

        return false;
    }
}