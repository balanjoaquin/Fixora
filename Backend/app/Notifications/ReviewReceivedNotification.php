<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\Review;
use App\Notifications\Concerns\ConfiguresFixoraNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ReviewReceivedNotification extends Notification implements ShouldQueue
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
            ->action('Ver tus reseñas en FIXORA', $payload['url'])
            ->salutation('Saludos, equipo FIXORA');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'review.received',
            'title' => 'Nueva reseña recibida',
            'body' => "Has recibido una reseña con calificación de {$this->review->rating} sobre 5.",
            'review_id' => $this->review->id,
            'url' => $this->frontendUrl('/technician/reviews'),
        ];
    }
}