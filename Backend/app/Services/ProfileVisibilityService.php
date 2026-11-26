<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\UserStatus;
use App\Models\AvailabilitySlot;
use App\Models\TechnicianProfile;
use Illuminate\Support\Facades\DB;

class ProfileVisibilityService
{
    public function recalculate(TechnicianProfile $profile): TechnicianProfile
    {
        $profile->refresh();
        $profile->load('user');
        $user = $profile->user;

        $hasSpecialties = DB::table('specialty_technician')
            ->where('technician_profile_id', $profile->id)
            ->exists();

        $hasAvailabilitySlots = AvailabilitySlot::query()
            ->where('technician_profile_id', $profile->id)
            ->exists();

        $isEligible = $user !== null
            && $user->status === UserStatus::Active
            && $user->hasVerifiedEmail()
            && filled($user->phone)
            && $profile->latitude !== null
            && $profile->longitude !== null
            && $hasSpecialties
            && $hasAvailabilitySlots;

        if ($profile->is_visible !== $isEligible) {
            $profile->is_visible = $isEligible;
            $profile->save();
        }

        return $profile->refresh();
    }
}