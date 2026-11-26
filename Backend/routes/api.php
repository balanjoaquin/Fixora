<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\AccountController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\EmailVerificationController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PasswordResetController;
use App\Http\Controllers\Api\V1\PublicTechnicianController;
use App\Http\Controllers\Api\V1\ReviewController;
use App\Http\Controllers\Api\V1\ServiceRequestController;
use App\Http\Controllers\Api\V1\SpecialtyController;
use App\Http\Controllers\Api\V1\TechnicianAvailabilityController;
use App\Http\Controllers\Api\V1\TechnicianProfileController;
use App\Http\Controllers\Api\V1\TechnicianServiceController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    // Catálogo público de especialidades y directorio de técnicos (B2, B3)
    Route::get('specialties', [SpecialtyController::class, 'index']);
    Route::get('technicians', [PublicTechnicianController::class, 'index']);
    Route::get('technicians/{id}', [PublicTechnicianController::class, 'show'])->whereNumber('id');
    Route::get('technicians/{id}/reviews', [ReviewController::class, 'publicIndex'])->whereNumber('id');

    // Autenticación, verificación de correo y recuperación de contraseña (B2, B7)
    Route::prefix('auth')->group(function (): void {
        Route::post('register', [AuthController::class, 'register']);
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
        Route::get('email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
            ->whereNumber('id')
            ->name('api.v1.auth.email.verify');
        Route::post('forgot-password', [PasswordResetController::class, 'forgotPassword'])
            ->middleware('throttle:forgot-password');
        Route::post('reset-password', [PasswordResetController::class, 'resetPassword'])
            ->middleware('throttle:reset-password');

        Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::get('me', [AuthController::class, 'me']);
            Route::post('email/resend', [EmailVerificationController::class, 'resend'])
                ->middleware('throttle:email-verification-resend');
        });
    });

    // Rutas autenticadas
    Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
        // Cuenta (B2)
        Route::put('account', [AccountController::class, 'update']);
        Route::put('account/password', [AccountController::class, 'updatePassword']);
        Route::post('account/avatar', [AccountController::class, 'updateAvatar']);
        Route::delete('account/avatar', [AccountController::class, 'deleteAvatar']);
        Route::put('me', [AccountController::class, 'update']);
        Route::put('me/password', [AccountController::class, 'updatePassword']);

        // Notificaciones dentro de la app (B7)
        Route::get('notifications', [NotificationController::class, 'index']);
        Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('notifications/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::post('notifications/{id}/read', [NotificationController::class, 'markAsRead']);

        // Solicitudes de servicio y seguimiento (B4, B7)
        Route::get('requests', [ServiceRequestController::class, 'index']);
        Route::post('requests', [ServiceRequestController::class, 'store'])
            ->middleware(['verified', 'throttle:create-requests']);
        Route::get('requests/{serviceRequest}', [ServiceRequestController::class, 'show'])->whereNumber('serviceRequest');
        Route::get('requests/{serviceRequest}/messages', [ServiceRequestController::class, 'messages'])->whereNumber('serviceRequest');
        Route::post('requests/{serviceRequest}/messages', [ServiceRequestController::class, 'sendMessage'])->whereNumber('serviceRequest');
        Route::post('requests/{serviceRequest}/accept', [ServiceRequestController::class, 'accept'])->whereNumber('serviceRequest');
        Route::post('requests/{serviceRequest}/reject', [ServiceRequestController::class, 'reject'])->whereNumber('serviceRequest');
        Route::post('requests/{serviceRequest}/start', [ServiceRequestController::class, 'start'])->whereNumber('serviceRequest');
        Route::post('requests/{serviceRequest}/complete', [ServiceRequestController::class, 'complete'])->whereNumber('serviceRequest');
        Route::post('requests/{serviceRequest}/cancel', [ServiceRequestController::class, 'cancel'])->whereNumber('serviceRequest');

        // Calificaciones y reseñas (B5)
        Route::post('requests/{serviceRequest}/review', [ReviewController::class, 'store'])->whereNumber('serviceRequest');
        Route::post('reviews/{review}/reply', [ReviewController::class, 'reply'])->whereNumber('review');

        // Gestión del técnico (B2, B3)
        Route::middleware('role:technician')->prefix('technician')->group(function (): void {
            Route::get('profile', [TechnicianProfileController::class, 'show']);
            Route::put('profile', [TechnicianProfileController::class, 'update']);
            Route::post('avatar', [TechnicianProfileController::class, 'uploadAvatar']);
            Route::delete('avatar', [TechnicianProfileController::class, 'deleteAvatar']);
            Route::put('specialties', [TechnicianProfileController::class, 'syncSpecialties']);

            Route::get('services', [TechnicianServiceController::class, 'index']);
            Route::post('services', [TechnicianServiceController::class, 'store']);
            Route::put('services/{service}', [TechnicianServiceController::class, 'update'])->whereNumber('service');
            Route::delete('services/{service}', [TechnicianServiceController::class, 'destroy'])->whereNumber('service');

            Route::get('availability', [TechnicianAvailabilityController::class, 'index']);
            Route::put('availability', [TechnicianAvailabilityController::class, 'update']);

            Route::get('reviews', [ReviewController::class, 'technicianIndex']);
        });
    });
});