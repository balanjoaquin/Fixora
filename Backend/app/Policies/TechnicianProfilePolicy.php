<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\TechnicianProfile;
use App\Models\User;

class TechnicianProfilePolicy
{
    public function view(User $user, TechnicianProfile $profile): bool
    {
        return $user->role === UserRole::Technician && $profile->user_id === $user->id;
    }

    public function update(User $user, TechnicianProfile $profile): bool
    {
        return $user->role === UserRole::Technician && $profile->user_id === $user->id;
    }

    public function syncSpecialties(User $user, TechnicianProfile $profile): bool
    {
        return $user->role === UserRole::Technician && $profile->user_id === $user->id;
    }

    public function manageAvailability(User $user, TechnicianProfile $profile): bool
    {
        return $user->role === UserRole::Technician && $profile->user_id === $user->id;
    }
}