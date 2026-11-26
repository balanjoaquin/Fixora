<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\PublicReviewController;
use App\Http\Controllers\Api\V1\ReviewController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    // Consulta pública de opiniones de un técnico visible y activo
    Route::middleware('throttle:public-reviews')->group(function (): void {
        Route::get('/technicians/{id}/reviews', [PublicReviewController::class, 'index'])
            ->whereNumber('id');
    });

    // Rutas autenticadas
    Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
        // Cliente: crear reseña verificada sobre una solicitud completada
        Route::middleware(['role:client', 'throttle:review-actions'])->group(function (): void {
            Route::post('/requests/{id}/review', [ReviewController::class, 'store'])
                ->whereNumber('id');
        });

        // Técnico: listar reseñas recibidas y responder públicamente
        Route::middleware('role:technician')->group(function (): void {
            Route::get('/technician/reviews', [ReviewController::class, 'technicianIndex']);

            Route::post('/reviews/{id}/reply', [ReviewController::class, 'reply'])
                ->whereNumber('id')
                ->middleware('throttle:review-actions');
        });
    });
});