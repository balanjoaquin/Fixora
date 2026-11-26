<?php

declare(strict_types=1);

namespace App\Events;

use App\Enums\ServiceRequestStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use BackedEnum;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ServiceRequestStatusChanged implements ShouldDispatchAfterCommit
{
    use Dispatchable;
    use SerializesModels;

    public readonly ?string $fromStatus;
    public readonly string $toStatus;

    public function __construct(
        public readonly ServiceRequest $serviceRequest,
        ServiceRequestStatus|string|null $fromStatus,
        ServiceRequestStatus|string $toStatus,
        public readonly ?User $actor = null,
        public readonly ?string $reason = null,
    ) {
        $this->fromStatus = $fromStatus instanceof BackedEnum ? (string) $fromStatus->value : $fromStatus;
        $this->toStatus = $toStatus instanceof BackedEnum ? (string) $toStatus->value : $toStatus;
    }
}