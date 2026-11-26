<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\ServiceRequestStatus;
use App\Enums\UserStatus;
use App\Models\ServiceRequest;
use App\Notifications\RequestExpiringSoonNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class NotifyExpiringRequestsCommand extends Command
{
    protected $signature = 'fixora:notify-expiring-requests';

    protected $description = 'Notifica a los técnicos sobre solicitudes pendientes próximas a vencer.';

    public function handle(): int
    {
        $warningHours = (int) config('fixora.expiry_warning_hours', 12);
        $appTimezone = (string) config('app.timezone', 'America/Mexico_City');
        $now = Carbon::now($appTimezone);
        $threshold = $now->copy()->addHours($warningHours);
        $notifiedCount = 0;

        ServiceRequest::query()
            ->where('status', ServiceRequestStatus::Pending)
            ->whereNull('expiry_warning_sent_at')
            ->where('expires_at', '>', $now)
            ->where('expires_at', '<=', $threshold)
            ->with('technicianProfile.user')
            ->chunkById(100, function ($requests) use (&$notifiedCount, $appTimezone): void {
                foreach ($requests as $serviceRequest) {
                    $claimed = DB::transaction(function () use ($serviceRequest, $appTimezone): bool {
                        $affected = ServiceRequest::query()
                            ->whereKey($serviceRequest->id)
                            ->where('status', ServiceRequestStatus::Pending)
                            ->whereNull('expiry_warning_sent_at')
                            ->update(['expiry_warning_sent_at' => Carbon::now($appTimezone)]);

                        return $affected === 1;
                    });

                    if (! $claimed) {
                        continue;
                    }

                    $technician = $serviceRequest->technicianProfile?->user;

                    if ($technician !== null && $technician->status !== UserStatus::Suspended) {
                        $technician->notify(new RequestExpiringSoonNotification($serviceRequest));
                        $notifiedCount++;
                    }
                }
            });

        $this->info("Avisos de vencimiento enviados: {$notifiedCount}.");

        return self::SUCCESS;
    }
}