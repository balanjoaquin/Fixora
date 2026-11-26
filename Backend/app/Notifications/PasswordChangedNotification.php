<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PasswordChangedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct()
    {
        $this->afterCommit();
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
        return (new MailMessage())
            ->subject('Tu contraseña fue cambiada en FIXORA')
            ->greeting('Hola,')
            ->line('Te confirmamos que la contraseña de tu cuenta en FIXORA fue actualizada correctamente.')
            ->line('Por seguridad, todas tus sesiones anteriores fueron cerradas.')
            ->line('Si no reconoces este movimiento, solicita un nuevo restablecimiento de inmediato.')
            ->salutation('Saludos, equipo FIXORA');
    }
}