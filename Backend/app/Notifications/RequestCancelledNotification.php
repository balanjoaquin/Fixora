<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\ServiceRequest;
use App\Notifications\Concerns\ConfiguresFixoraNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RequestCancelledNotification extends Notification implements ShouldQueue
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
            ->line('Estado actual: Cancelada.')
            ->action('Ver detalle en FIXORA', $payload['url'])
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
            'type' => 'request.cancelled',
            'title' => 'Solicitud cancelada',
            'body' => "La solicitud \"{$title}\" fue cancelada.{$reasonSuffix}",
            'request_id' => $this->serviceRequest->id,
            'url' => $this->frontendUrl("/requests/{$this->serviceRequest->id}"),
        ];
    }
}