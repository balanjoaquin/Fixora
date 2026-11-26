<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Review extends Model
{
    use HasFactory;

    protected $fillable = [
        'service_request_id',
        'client_id',
        'technician_profile_id',
        'rating',
        'comment',
        'photos',
        'technician_reply',
        'replied_at',
        'is_hidden',
        'moderated_by',
        'moderation_reason',
        'moderated_at',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'photos' => 'array',
            'replied_at' => 'datetime',
            'is_hidden' => 'boolean',
            'moderated_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function getPhotosAttribute(mixed $value): array
    {
        $items = is_string($value) ? json_decode($value, true) : $value;
        if (! is_array($items)) {
            return [];
        }

        return array_values(array_filter(array_map(static function (mixed $item): ?string {
            if (! is_string($item) || trim($item) === '') {
                return null;
            }

            $trimmed = trim($item);
            if (preg_match('#^(?:https?://[^/]+)?(/storage/.*)$#i', $trimmed, $matches)) {
                return $matches[1];
            }

            if (str_starts_with($trimmed, 'http://') || str_starts_with($trimmed, 'https://')) {
                return $trimmed;
            }

            return '/' . ltrim($trimmed, '/');
        }, $items)));
    }

    public function serviceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function technicianProfile(): BelongsTo
    {
        return $this->belongsTo(TechnicianProfile::class);
    }

    public function moderator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'moderated_by');
    }
}