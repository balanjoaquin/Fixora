<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ActorRole;
use App\Enums\ServiceRequestStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class RequestEvent extends Model
{
    use HasFactory;

    public const UPDATED_AT = null;

    protected $fillable = [
        'service_request_id',
        'from_status',
        'to_status',
        'actor_id',
        'actor_role',
        'reason',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'from_status' => ServiceRequestStatus::class,
            'to_status' => ServiceRequestStatus::class,
            'actor_id' => 'integer',
            'actor_role' => ActorRole::class,
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (): void {
            throw new LogicException('RequestEvent es inmutable y no permite actualizaciones.');
        });

        static::deleting(function (): void {
            throw new LogicException('RequestEvent es inmutable y no permite eliminaciones.');
        });
    }

    public function serviceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}