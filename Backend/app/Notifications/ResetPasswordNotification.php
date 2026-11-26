<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword as BaseResetPassword;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public readonly ?string $originUrl;

    public function __construct(public readonly string $token, ?string $originUrl = null)
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
        if (! $notifiable instanceof User) {
            return [];
        }

        if ($notifiable->status === UserStatus::Suspended || $notifiable->role === UserRole::Admin) {
            return [];
        }

        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        /** @var User $notifiable */
        $minutes = (int) config('fixora.password_reset_expire_minutes', 60);

        if (is_callable(BaseResetPassword::$createUrlCallback)) {
            $resetUrl = (string) call_user_func(BaseResetPassword::$createUrlCallback, $notifiable, $this->token);
        } else {
            $base = $this->originUrl
                ?: rtrim((string) config('fixora.frontend_url', 'http://localhost:5173'), '/');
            $resetUrl = $base
                . '/reset-password?token=' . urlencode($this->token)
                . '&email=' . urlencode($notifiable->getEmailForPasswordReset());
        }

        return (new MailMessage())
            ->subject('Recuperación de contraseña en FIXORA')
            ->greeting('Hola,')
            ->line('Recibimos una solicitud para restablecer la contraseña de tu cuenta en FIXORA.')
            ->action('Restablecer contraseña', $resetUrl)
            ->line("Este enlace caduca en {$minutes} minutos y solo puede utilizarse una vez.")
            ->line('Si no solicitaste este cambio, puedes ignorar este correo.')
            ->salutation('Saludos, equipo FIXORA');
    }
}