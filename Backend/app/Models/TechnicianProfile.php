<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TechnicianProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'headline',
        'bio',
        'avatar_path',
        'years_experience',
        'service_zone',
        'latitude',
        'longitude',
        'service_radius_km',
        'is_visible',
        'rating_avg',
        'rating_count',
        'completed_count',
        'verified_at',
    ];

    protected $appends = [
        'avatar_url',
    ];

    protected function casts(): array
    {
        return [
            'years_experience' => 'integer',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'service_radius_km' => 'integer',
            'is_visible' => 'boolean',
            'rating_avg' => 'decimal:2',
            'rating_count' => 'integer',
            'completed_count' => 'integer',
            'verified_at' => 'datetime',
        ];
    }

    public function getAvatarUrlAttribute(): ?string
    {
        if (! $this->avatar_path) {
            return null;
        }

        if (str_starts_with($this->avatar_path, 'http://') || str_starts_with($this->avatar_path, 'https://')) {
            return preg_replace('#^https?://(localhost|127\.0\.0\.1)(:\d+)?#i', '', $this->avatar_path) ?: $this->avatar_path;
        }

        return '/storage/' . ltrim($this->avatar_path, '/');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function specialties(): BelongsToMany
    {
        return $this->belongsToMany(Specialty::class, 'specialty_technician');
    }

    public function services(): HasMany
    {
        return $this->hasMany(TechnicianService::class);
    }

    public function availabilitySlots(): HasMany
    {
        return $this->hasMany(AvailabilitySlot::class);
    }

    public function serviceRequests(): HasMany
    {
        return $this->hasMany(ServiceRequest::class);
    }
}