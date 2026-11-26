<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\UpdateAvailabilityRequest;
use App\Http\Resources\Api\V1\AvailabilitySlotResource;
use App\Services\AvailabilityService;
use App\Services\ProfileService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TechnicianAvailabilityController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly AvailabilityService $availabilityService,
        private readonly ProfileService $profileService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $profile = $this->profileService->getOrCreateTechnicianProfile($user);

        $this->authorize('manageAvailability', $profile);

        $slots = $this->availabilityService->listSlots($profile);

        return response()->json([
            'data' => AvailabilitySlotResource::collection($slots),
        ]);
    }

    public function update(UpdateAvailabilityRequest $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $profile = $this->profileService->getOrCreateTechnicianProfile($user);

        $this->authorize('manageAvailability', $profile);

        $slots = $this->availabilityService->replaceSlots(
            profile: $profile,
            slots: $request->validated()['slots'],
        );

        return response()->json([
            'message' => 'Disponibilidad semanal actualizada correctamente.',
            'data' => AvailabilitySlotResource::collection($slots),
        ]);
    }
}