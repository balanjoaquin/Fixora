<?php

declare(strict_types=1);

namespace App\Notifications\Concerns;

use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Bus\Queueable;

trait ConfiguresFixoraNotification
{
    use Queueable;

    public int $tries = 3;

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

        if ($notifiable->status === UserStatus::Suspended) {
            return [];
        }

        $channels = ['database'];

        if ($notifiable->hasVerifiedEmail()) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    protected function frontendUrl(string $path): string
    {
        $base = rtrim((string) config('fixora.frontend_url', 'http://localhost:3000'), '/');

        return $base . '/' . ltrim($path, '/');
    }
}