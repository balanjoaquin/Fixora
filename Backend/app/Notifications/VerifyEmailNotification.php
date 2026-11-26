<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

class VerifyEmailNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public readonly ?string $originUrl;

    public function __construct(?string $originUrl = null)
    {
        $this->originUrl = $originUrl ?? self::detectCurrentOrigin();
        $this->afterCommit();
    }

    private static function detectCurrentOrigin(): ?string
    {
        if (app()->runningInConsole() || ! app()->bound('request')) {
            return null;
        }

        $request = request();
        $origin = $request->headers->get('origin');
        if (is_string($origin) && $origin !== '' && str_starts_with($origin, 'http')) {
            return rtrim($origin, '/');
        }

        $host = $request->getSchemeAndHttpHost();
        if ($host !== '' && ! str_contains($host, '127.0.0.1') && ! str_contains($host, 'localhost')) {
            return rtrim($host, '/');
        }

        return null;
    }

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [10, 60, 300];
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if (! $notifiable instanceof User || $notifiable->status === UserStatus::Suspended) {
            return [];
        }

        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        /** @var User $notifiable */
        $minutes = (int) config('fixora.verification_expire_minutes', 60);

        $previousRoot = URL::to('/');
        $appUrl = rtrim((string) config('app.url', ''), '/');
        $isPublicBackend = $appUrl !== ''
            && ! str_contains($appUrl, '127.0.0.1')
            && ! str_contains($appUrl, 'localhost');

        $targetBase = $isPublicBackend
            ? $appUrl
            : ($this->originUrl ?: rtrim((string) config('fixora.frontend_url', $appUrl), '/'));

        if ($targetBase !== '') {
            URL::forceRootUrl($targetBase);
            if (str_starts_with($targetBase, 'https://')) {
                URL::forceScheme('https');
            }
        }

        try {
            $verificationUrl = URL::temporarySignedRoute(
                'api.v1.auth.email.verify',
                now()->addMinutes($minutes),
                [
                    'id' => $notifiable->getKey(),
                    'hash' => sha1($notifiable->getEmailForVerification()),
                ]
            );
        } finally {
            URL::forceRootUrl($previousRoot);
            URL::forceScheme(null);
        }

        return (new MailMessage())
            ->subject('Verifica tu correo electrónico en FIXORA')
            ->greeting('Hola,')
            ->line('Gracias por registrarte en FIXORA. Para activar todas las funciones de tu cuenta, confirma tu dirección de correo electrónico.')
            ->action('Verificar correo electrónico', $verificationUrl)
            ->line("Este enlace caduca en {$minutes} minutos.")
            ->line('Si no creaste esta cuenta, puedes ignorar este mensaje.')
            ->salutation('Saludos, equipo FIXORA');
    }
}