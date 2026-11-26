<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class EmailVerificationController extends Controller
{
    /**
     * Reenvía el enlace de verificación al correo del usuario autenticado.
     */
    public function resend(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'No autenticado.',
            ], 401);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Tu correo electrónico ya está verificado.',
                'data' => [
                    'verified' => true,
                ],
            ]);
        }

        $user->sendEmailVerificationNotification();

        return response()->json([
            'message' => 'Enlace de verificación enviado a '.$user->email.'.',
            'data' => [
                'verified' => false,
                'email' => $user->email,
            ],
        ]);
    }

    /**
     * Valida el enlace firmado de verificación y redirige al frontend.
     */
    public function verify(Request $request, int $id, string $hash): RedirectResponse|JsonResponse
    {
        $frontendUrl = $this->resolveFrontendUrl($request);

        $validSignature = $request->hasValidSignature()
            || $request->hasValidRelativeSignature()
            || $this->hasValidFallbackSignature($request);

        if (! $validSignature) {
            Log::warning('Email verification invalid signature', [
                'full_url' => $request->fullUrl(),
                'app_url' => config('app.url'),
                'query' => $request->query(),
            ]);

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'El enlace de verificación es inválido o ha expirado.',
                ], 403);
            }

            return redirect()->away($frontendUrl.'/email-verified?status=invalid');
        }

        $user = User::findOrFail($id);

        if (! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            Log::warning('Email verification hash mismatch', [
                'user_id' => $id,
                'expected' => sha1($user->getEmailForVerification()),
                'received' => $hash,
            ]);

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'El enlace de verificación no corresponde al usuario.',
                ], 403);
            }

            return redirect()->away($frontendUrl.'/email-verified?status=invalid');
        }

        if (! $user->hasVerifiedEmail()) {
            if ($user->markEmailAsVerified()) {
                event(new Verified($user));
            }
        }

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Correo electrónico verificado correctamente.',
                'data' => [
                    'verified' => true,
                ],
            ]);
        }

        return redirect()->away($frontendUrl.'/email-verified?status=verified');
    }

    private function resolveFrontendUrl(Request $request): string
    {
        $host = $request->getHost();
        $port = $request->getPort();

        if ($host !== '' && str_ends_with($host, '.trycloudflare.com')) {
            return 'https://'.$host;
        }

        if (in_array($host, ['127.0.0.1', 'localhost'], true) && $port === 5173) {
            return $request->getScheme().'://'.$host.':5173';
        }

        $configuredFrontend = (string) (config('fixora.frontend_url') ?: env('FRONTEND_URL', 'http://localhost:5173'));

        return rtrim($configuredFrontend, '/');
    }

    private function hasValidFallbackSignature(Request $request): bool
    {
        $expires = (string) $request->query('expires', '');
        $signature = (string) $request->query('signature', '');

        if ($expires === '' || $signature === '' || (int) $expires < now()->timestamp) {
            return false;
        }

        $key = (string) config('app.key');
        if (str_starts_with($key, 'base64:')) {
            $key = (string) base64_decode(substr($key, 7));
        }

        $pathWithQuery = $request->getPathInfo().'?expires='.$expires;
        $candidates = [
            rtrim((string) config('app.url'), '/').$pathWithQuery,
            'http://localhost:8000'.$pathWithQuery,
            'http://127.0.0.1:8000'.$pathWithQuery,
        ];

        foreach ($candidates as $url) {
            if (hash_equals(hash_hmac('sha256', $url, $key), $signature)) {
                return true;
            }
        }

        return false;
    }
}