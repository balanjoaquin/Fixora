<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\ServiceRequest;
use App\Notifications\Concerns\ConfiguresFixoraNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RequestRejectedNotification extends Notification implements ShouldQueue
{
    use ConfiguresFixoraNotification;

    public function __construct(
        public readonly ServiceRequest $serviceRequest,
        public readonly ?string $reason = null,
    ) {
        $this->afterCommit();
    }

    public function toMail(object $notifiable): MailMessage
    {
        $payload = $this->toArray($notifiable);

        return (new MailMessage())
            ->subject($payload['title'] . ' — FIXORA')
            ->greeting('Hola,')
            ->line($payload['body'])
            ->line('Estado actual: Rechazada.')
            ->action('Ver solicitud en FIXORA', $payload['url'])
            ->salutation('Saludos, equipo FIXORA');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $title = (string) ($this->serviceRequest->title ?? 'Solicitud de servicio');
        $cleanReason = trim((string) $this->reason);
        $reasonSuffix = $cleanReason !== '' ? " Motivo: {$cleanReason}." : '';

        return [
            'type' => 'request.rejected',
            'title' => 'Solicitud rechazada',
            'body' => "Tu solicitud \"{$title}\" fue rechazada.{$reasonSuffix}",
            'request_id' => $this->serviceRequest->id,
            'url' => $this->frontendUrl("/requests/{$this->serviceRequest->id}"),
        ];
    }
}