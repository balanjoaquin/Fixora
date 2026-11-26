<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\ServiceRequest;
use App\Notifications\Concerns\ConfiguresFixoraNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RequestExpiringSoonNotification extends Notification implements ShouldQueue
{
    use ConfiguresFixoraNotification;

    public function __construct(public readonly ServiceRequest $serviceRequest)
    {
        $this->afterCommit();
    }

    public function toMail(object $notifiable): MailMessage
    {
        $payload = $this->toArray($notifiable);

        return (new MailMessage())
            ->subject($payload['title'] . ' — FIXORA')
            ->greeting('Hola,')
            ->line($payload['body'])
            ->line('Estado actual: Pendiente.')
            ->action('Responder solicitud en FIXORA', $payload['url'])
            ->salutation('Saludos, equipo FIXORA');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $title = (string) ($this->serviceRequest->title ?? 'Solicitud de servicio');

        return [
            'type' => 'request.expiring_soon',
            'title' => 'Solicitud próxima a vencer',
            'body' => "La solicitud \"{$title}\" está próxima a vencer. Respóndela antes de que expire.",
            'request_id' => $this->serviceRequest->id,
            'url' => $this->frontendUrl("/requests/{$this->serviceRequest->id}"),
        ];
    }
}