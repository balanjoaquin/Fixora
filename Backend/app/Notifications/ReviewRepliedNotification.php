<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\Review;
use App\Notifications\Concerns\ConfiguresFixoraNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ReviewRepliedNotification extends Notification implements ShouldQueue
{
    use ConfiguresFixoraNotification;

    public function __construct(public readonly Review $review)
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
            ->action('Ver respuesta en FIXORA', $payload['url'])
            ->salutation('Saludos, equipo FIXORA');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'review.replied',
            'title' => 'El técnico respondió a tu reseña',
            'body' => 'El técnico respondió a la calificación que dejaste sobre su servicio.',
            'review_id' => $this->review->id,
            'url' => $this->frontendUrl("/requests/{$this->review->service_request_id}"),
        ];
    }
}