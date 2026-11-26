<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\NotificationResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        $perPage = min(max($request->integer('per_page', 15), 1), 50);
        $onlyUnread = filter_var($request->query('unread', false), FILTER_VALIDATE_BOOLEAN);

        $query = $user->notifications()
            ->when($onlyUnread, static function ($q): void {
                $q->whereNull('read_at');
            })
            ->orderByDesc('created_at');

        return NotificationResource::collection($query->paginate($perPage));
    }

    public function unreadCount(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    public function markAsRead(Request $request, string $id): NotificationResource
    {
        /** @var User $user */
        $user = $request->user();

        /** @var DatabaseNotification|null $notification */
        $notification = $user->notifications()->where('id', $id)->first();

        if ($notification === null) {
            abort(404);
        }

        if ($notification->read_at === null) {
            $notification->markAsRead();
        }

        return new NotificationResource($notification->fresh());
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $updatedCount = $user->unreadNotifications()->update([
            'read_at' => now(),
        ]);

        return response()->json([
            'message' => 'Todas las notificaciones fueron marcadas como leídas.',
            'updated_count' => $updatedCount,
        ]);
    }
}