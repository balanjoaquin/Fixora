<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ForgotPasswordRequest;
use App\Http\Requests\Api\V1\ResetPasswordRequest;
use App\Models\User;
use App\Notifications\PasswordChangedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Password;

class PasswordResetController extends Controller
{
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $email = (string) $request->validated('email');

        /** @var User|null $user */
        $user = User::query()->where('email', $email)->first();

        if ($user !== null && $user->status === UserStatus::Active && $user->role !== UserRole::Admin) {
            Password::broker()->sendResetLink(['email' => $user->email]);
        }

        return response()->json([
            'message' => 'Si el correo existe, te enviamos instrucciones.',
        ], 200);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $validated = $request->validated();

        /** @var User|null $user */
        $user = User::query()->where('email', $validated['email'])->first();

        if ($user === null || $user->status === UserStatus::Suspended || $user->role === UserRole::Admin) {
            return $this->invalidResetResponse();
        }

        $status = Password::broker()->reset(
            [
                'email' => $validated['email'],
                'password' => $validated['password'],
                'token' => $validated['token'],
            ],
            function (User $resetUser, string $password): void {
                $resetUser->forceFill([
                    'password' => $password,
                ])->save();

                $resetUser->tokens()->delete();
                $resetUser->notify(new PasswordChangedNotification());
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return $this->invalidResetResponse();
        }

        return response()->json([
            'message' => 'Tu contraseña ha sido restablecida correctamente. Inicia sesión con tu nueva contraseña.',
        ], 200);
    }

    private function invalidResetResponse(): JsonResponse
    {
        return response()->json([
            'message' => 'El enlace o token de recuperación no es válido o ha expirado.',
            'errors' => [
                'token' => ['El enlace o token de recuperación no es válido o ha expirado.'],
            ],
        ], 422);
    }
}