<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use BackedEnum;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if ($user === null) {
            return response()->json([
                'message' => 'No autenticado.',
            ], 401);
        }

        $currentStatus = $user->status instanceof BackedEnum
            ? (string) $user->status->value
            : (string) $user->status;

        if ($currentStatus !== 'active') {
            return response()->json([
                'message' => 'Tu cuenta no se encuentra activa.',
            ], 403);
        }

        $currentRole = $user->role instanceof BackedEnum
            ? (string) $user->role->value
            : (string) $user->role;

        if (!in_array($currentRole, $roles, true)) {
            return response()->json([
                'message' => 'No tienes permiso para realizar esta acción.',
            ], 403);
        }

        return $next($request);
    }
}