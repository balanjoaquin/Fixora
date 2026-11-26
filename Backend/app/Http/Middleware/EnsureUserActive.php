<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Enums\UserStatus;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user() ?? $request->user('sanctum');

        if ($user instanceof User) {
            $currentStatus = User::query()
                ->whereKey($user->getKey())
                ->value('status');

            $statusValue = $currentStatus instanceof UserStatus
                ? $currentStatus->value
                : (string) $currentStatus;

            if ($statusValue === '' || $statusValue === UserStatus::Suspended->value) {
                if ($request->expectsJson() || $request->is('api/*')) {
                    return response()->json([
                        'message' => 'Tu cuenta se encuentra suspendida.',
                    ], Response::HTTP_FORBIDDEN);
                }

                abort(Response::HTTP_FORBIDDEN, 'Tu cuenta se encuentra suspendida.');
            }
        }

        return $next($request);
    }
}