<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ServiceRequestStatus;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

class ServiceRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_id',
        'technician_profile_id',
        'specialty_id',
        'technician_service_id',
        'title',
        'description',
        'photos',
        'address_line',
        'approx_zone',
        'latitude',
        'longitude',
        'preferred_date',
        'preferred_start',
        'status',
        'expires_at',
        'accepted_at',
        'started_at',
        'completed_at',
        'closed_at',
        'closed_by',
        'closing_reason',
    ];

    protected function casts(): array
    {
        return [
            'photos' => 'array',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'preferred_date' => 'date',
            'status' => ServiceRequestStatus::class,
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'closed_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    protected function expiresAt(): Attribute
    {
        return Attribute::make(
            set: function (mixed $value): ?Carbon {
                if ($value === null) {
                    return null;
                }

                $appTimezone = (string) config('app.timezone', 'America/Mexico_City');

                if ($value instanceof DateTimeInterface) {
                    return Carbon::instance($value)->setTimezone($appTimezone);
                }

                return Carbon::parse((string) $value, $appTimezone);
            },
        );
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function technicianProfile(): BelongsTo
    {
        return $this->belongsTo(TechnicianProfile::class);
    }

    public function specialty(): BelongsTo
    {
        return $this->belongsTo(Specialty::class);
    }

    public function technicianService(): BelongsTo
    {
        return $this->belongsTo(TechnicianService::class);
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function events(): HasMany
    {
        return $this->hasMany(RequestEvent::class)->orderBy('created_at');
    }

    public function review(): HasOne
    {
        return $this->hasOne(Review::class);
    }
}