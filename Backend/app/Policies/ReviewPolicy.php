<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Review;
use App\Models\ServiceRequest;
use App\Models\User;

class ReviewPolicy
{
    public function create(User $user, ServiceRequest $serviceRequest): bool
    {
        return $user->status === UserStatus::Active
            && $user->role === UserRole::Client
            && (int) $serviceRequest->client_id === (int) $user->id;
    }

    public function reply(User $user, Review $review): bool
    {
        if (
            $user->status !== UserStatus::Active
            || $user->role !== UserRole::Technician
            || $user->technicianProfile === null
        ) {
            return false;
        }

        return (int) $review->technician_profile_id === (int) $user->technicianProfile->id
            && !(bool) $review->is_hidden;
    }

    public function viewTechnicianList(User $user): bool
    {
        return $user->status === UserStatus::Active
            && $user->role === UserRole::Technician
            && $user->technicianProfile !== null;
    }
}