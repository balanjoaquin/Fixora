<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\ServiceRequestStatus;
use App\Exceptions\InvalidTransitionException;
use App\Models\ServiceRequest;
use App\Services\ServiceRequestStateMachine;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class ExpireServiceRequestsCommand extends Command
{
    protected $signature = 'fixora:expire-requests';

    protected $description = 'Marca como expired las solicitudes pendientes cuyo plazo expires_at ha vencido.';

    public function handle(ServiceRequestStateMachine $stateMachine): int
    {
        $nowLocal = Carbon::now((string) config('app.timezone', 'America/Mexico_City'));
        $expiredCount = 0;

        ServiceRequest::query()
            ->where('status', ServiceRequestStatus::Pending->value)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', $nowLocal)
            ->orderBy('id')
            ->chunkById(100, function ($requests) use ($stateMachine, &$expiredCount): void {
                foreach ($requests as $serviceRequest) {
                    try {
                        $stateMachine->expire($serviceRequest);
                        $expiredCount++;
                    } catch (InvalidTransitionException) {
                        // Idempotencia ante transiciones concurrentes
                    }
                }
            });

        $this->info("Solicitudes expiradas: {$expiredCount}");

        return self::SUCCESS;
    }
}