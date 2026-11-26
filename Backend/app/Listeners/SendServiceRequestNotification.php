<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Enums\ServiceRequestStatus;
use App\Enums\UserStatus;
use App\Events\ServiceRequestStatusChanged;
use App\Models\User;
use App\Notifications\RequestAcceptedNotification;
use App\Notifications\RequestCancelledNotification;
use App\Notifications\RequestCompletedNotification;
use App\Notifications\RequestCreatedNotification;
use App\Notifications\RequestExpiredClientNotification;
use App\Notifications\RequestExpiredTechnicianNotification;
use App\Notifications\RequestInProgressNotification;
use App\Notifications\RequestRejectedNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class SendServiceRequestNotification implements ShouldQueue
{
    public int $tries = 3;

    public function handle(ServiceRequestStatusChanged $event): void
    {
        $serviceRequest = $event->serviceRequest->load(['client', 'technicianProfile.user']);
        $client = $serviceRequest->client;
        $technician = $serviceRequest->technicianProfile?->user;

        if ($event->fromStatus === null && $event->toStatus === ServiceRequestStatus::Pending->value) {
            $this->dispatchToActiveUser($technician, new RequestCreatedNotification($serviceRequest));

            return;
        }

        match ($event->toStatus) {
            ServiceRequestStatus::Accepted->value => $this->dispatchToActiveUser(
                $client,
                new RequestAcceptedNotification($serviceRequest)
            ),
            ServiceRequestStatus::Rejected->value => $this->dispatchToActiveUser(
                $client,
                new RequestRejectedNotification($serviceRequest, $event->reason)
            ),
            ServiceRequestStatus::InProgress->value => $this->dispatchToActiveUser(
                $client,
                new RequestInProgressNotification($serviceRequest)
            ),
            ServiceRequestStatus::Completed->value => $this->dispatchToActiveUser(
                $client,
                new RequestCompletedNotification($serviceRequest)
            ),
            ServiceRequestStatus::Cancelled->value => $this->handleCancellation($event, $client, $technician),
            ServiceRequestStatus::Expired->value => $this->handleExpiration($serviceRequest, $client, $technician),
            default => null,
        };
    }

    private function handleCancellation(ServiceRequestStatusChanged $event, ?User $client, ?User $technician): void
    {
        $actorId = $event->actor?->id;

        if ($actorId === null) {
            return;
        }

        $recipient = $actorId === $client?->id ? $technician : ($actorId === $technician?->id ? $client : null);

        if ($recipient !== null && $recipient->id !== $actorId) {
            $this->dispatchToActiveUser(
                $recipient,
                new RequestCancelledNotification($event->serviceRequest, $event->reason)
            );
        }
    }

    private function handleExpiration($serviceRequest, ?User $client, ?User $technician): void
    {
        $this->dispatchToActiveUser($client, new RequestExpiredClientNotification($serviceRequest));
        $this->dispatchToActiveUser($technician, new RequestExpiredTechnicianNotification($serviceRequest));
    }

    private function dispatchToActiveUser(?User $recipient, Notification $notification): void
    {
        if ($recipient === null || $recipient->status === UserStatus::Suspended) {
            return;
        }

        $recipient->notify($notification);
    }
}