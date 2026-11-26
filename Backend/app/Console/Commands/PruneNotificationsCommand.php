<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Notifications\DatabaseNotification;

class PruneNotificationsCommand extends Command
{
    protected $signature = 'fixora:prune-notifications';

    protected $description = 'Elimina notificaciones antiguas leídas y no leídas según la política de retención.';

    public function handle(): int
    {
        $readRetentionDays = (int) config('fixora.read_notifications_retention_days', 90);
        $unreadRetentionDays = (int) config('fixora.unread_notifications_retention_days', 180);

        $deletedRead = DatabaseNotification::query()
            ->whereNotNull('read_at')
            ->where('created_at', '<', now()->subDays($readRetentionDays))
            ->delete();

        $deletedUnread = DatabaseNotification::query()
            ->whereNull('read_at')
            ->where('created_at', '<', now()->subDays($unreadRetentionDays))
            ->delete();

        $this->info("Notificaciones depuradas — leídas: {$deletedRead}, no leídas: {$deletedUnread}.");

        return self::SUCCESS;
    }
}