<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\UpdateAccountRequest;
use App\Http\Requests\Api\V1\UpdatePasswordRequest;
use App\Http\Resources\Api\V1\AccountResource;
use App\Services\ProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AccountController extends Controller
{
    public function __construct(
        private readonly ProfileService $profileService,
    ) {
    }

    public function update(UpdateAccountRequest $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $updated = $this->profileService->updateAccount($user, $request->validated());

        return response()->json([
            'message' => 'Datos de cuenta actualizados.',
            'data' => new AccountResource($updated),
        ]);
    }

    public function updatePassword(UpdatePasswordRequest $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $validated = $request->validated();

        $this->profileService->updatePassword(
            user: $user,
            currentPassword: $validated['current_password'],
            newPassword: $validated['password'],
        );

        return response()->json([
            'message' => 'Contraseña actualizada correctamente.',
        ]);
    }

    public function updateAvatar(Request $request): JsonResponse
    {
        $request->validate([
            'avatar' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ], [
            'avatar.required' => 'Selecciona una imagen para tu foto de perfil.',
            'avatar.image' => 'El archivo debe ser una imagen válida.',
            'avatar.mimes' => 'Formato no permitido. Usa JPG, PNG o WEBP.',
            'avatar.max' => 'La imagen no debe superar los 4 MB.',
        ]);

        /** @var \App\Models\User $user */
        $user = $request->user();

        if ($user->avatar_path && Storage::disk('public')->exists($user->avatar_path)) {
            Storage::disk('public')->delete($user->avatar_path);
        }

        $path = $request->file('avatar')->store("avatars/{$user->id}", 'public');

        $user->forceFill([
            'avatar_path' => $path,
        ])->save();

        return response()->json([
            'message' => 'Foto de perfil actualizada correctamente.',
            'data' => new AccountResource($user->fresh()),
        ]);
    }

    public function deleteAvatar(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        if ($user->avatar_path && Storage::disk('public')->exists($user->avatar_path)) {
            Storage::disk('public')->delete($user->avatar_path);
        }

        $user->forceFill([
            'avatar_path' => null,
        ])->save();

        return response()->json([
            'message' => 'Foto de perfil eliminada.',
            'data' => new AccountResource($user->fresh()),
        ]);
    }
}