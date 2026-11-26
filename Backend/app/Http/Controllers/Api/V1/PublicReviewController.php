<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ListPublicReviewsRequest;
use App\Http\Resources\Api\V1\PublicReviewResource;
use App\Services\ReviewService;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PublicReviewController extends Controller
{
    public function __construct(
        private readonly ReviewService $reviewService,
    ) {
    }

    /**
     * GET /api/v1/technicians/{id}/reviews
     */
    public function index(ListPublicReviewsRequest $request, int $id): AnonymousResourceCollection
    {
        $result = $this->reviewService->listPublicForTechnician($id, $request->validated());

        return PublicReviewResource::collection($result['paginator'])
            ->additional([
                'summary' => $result['summary'],
            ]);
    }
}