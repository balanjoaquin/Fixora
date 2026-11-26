<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\TechnicianService;
use App\Models\User;

class TechnicianServicePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->role === UserRole::Technician && $user->technicianProfile !== null;
    }

    public function create(User $user): bool
    {
        return $user->role === UserRole::Technician && $user->technicianProfile !== null;
    }

    public function view(User $user, TechnicianService $service): bool
    {
        return $user->role === UserRole::Technician
            && $user->technicianProfile !== null
            && $service->technician_profile_id === $user->technicianProfile->id;
    }

    public function update(User $user, TechnicianService $service): bool
    {
        return $user->role === UserRole::Technician
            && $user->technicianProfile !== null
            && $service->technician_profile_id === $user->technicianProfile->id;
    }

    public function delete(User $user, TechnicianService $service): bool
    {
        return $user->role === UserRole::Technician
            && $user->technicianProfile !== null
            && $service->technician_profile_id === $user->technicianProfile->id;
    }
}