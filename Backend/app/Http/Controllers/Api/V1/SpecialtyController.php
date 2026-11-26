<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\SpecialtyResource;
use App\Services\ProfileService;
use Illuminate\Http\JsonResponse;

class SpecialtyController extends Controller
{
    public function __construct(
        private readonly ProfileService $profileService,
    ) {
    }

    public function index(): JsonResponse
    {
        $specialties = $this->profileService->listActiveSpecialties();

        return response()->json([
            'data' => SpecialtyResource::collection($specialties),
        ]);
    }
}