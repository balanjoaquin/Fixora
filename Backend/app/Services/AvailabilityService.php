<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AvailabilitySlot;
use App\Models\TechnicianProfile;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Gestiona el horario semanal recurrente del técnico.
 *
 * Nota sobre zona horaria: Las franjas representan hora local de la zona de
 * servicio del técnico (horario semanal sin fecha específica) y se almacenan
 * y comparan directamente en formato HH:MM sin conversión a UTC.
 */
class AvailabilityService
{
    public function __construct(
        private readonly ProfileVisibilityService $visibilityService,
    ) {
    }

    /**
     * @return Collection<int, AvailabilitySlot>
     */
    public function listSlots(TechnicianProfile $profile): Collection
    {
        return AvailabilitySlot::query()
            ->where('technician_profile_id', $profile->id)
            ->orderBy('weekday')
            ->orderBy('start_time')
            ->get();
    }

    /**
     * Reemplaza atómicamente todo el horario semanal del técnico y recalcula
     * su visibilidad pública. Si $slots está vacío, is_visible pasa a 0.
     *
     * @param array<int, array{weekday: int, start_time: string, end_time: string}> $slots
     * @return Collection<int, AvailabilitySlot>
     */
    public function replaceSlots(TechnicianProfile $profile, array $slots): Collection
    {
        return DB::transaction(function () use ($profile, $slots): Collection {
            TechnicianProfile::query()
                ->whereKey($profile->id)
                ->lockForUpdate()
                ->first();

            AvailabilitySlot::query()
                ->where('technician_profile_id', $profile->id)
                ->delete();

            $normalized = $this->normalizeAndSortSlots($slots);

            foreach ($normalized as $slot) {
                AvailabilitySlot::query()->create([
                    'technician_profile_id' => $profile->id,
                    'weekday' => $slot['weekday'],
                    'start_time' => $slot['start_time'],
                    'end_time' => $slot['end_time'],
                ]);
            }

            $this->visibilityService->recalculate($profile);

            return $this->listSlots($profile);
        });
    }

    /**
     * @param array<int, array{weekday: int, start_time: string, end_time: string}> $slots
     * @return array<int, array{weekday: int, start_time: string, end_time: string}>
     */
    private function normalizeAndSortSlots(array $slots): array
    {
        $items = array_map(static fn (array $slot): array => [
            'weekday' => (int) $slot['weekday'],
            'start_time' => substr(trim((string) $slot['start_time']), 0, 5),
            'end_time' => substr(trim((string) $slot['end_time']), 0, 5),
        ], $slots);

        usort($items, static function (array $a, array $b): int {
            if ($a['weekday'] !== $b['weekday']) {
                return $a['weekday'] <=> $b['weekday'];
            }

            return strcmp($a['start_time'], $b['start_time']);
        });

        return $items;
    }
}