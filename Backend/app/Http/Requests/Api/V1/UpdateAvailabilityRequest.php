<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Valida la matriz semanal completa de disponibilidad del técnico.
 * Las horas se expresan en hora local de la zona de servicio (HH:MM), sin conversión a UTC.
 */
class UpdateAvailabilityRequest extends FormRequest
{
    private const MAX_SLOTS_PER_DAY = 5;
    private const MAX_SLOTS_TOTAL = 35;
    private const MIN_DURATION_MINUTES = 30;

    public function authorize(): bool
    {
        return $this->user()?->role === UserRole::Technician;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'slots' => ['present', 'array', 'max:' . self::MAX_SLOTS_TOTAL],
            'slots.*.weekday' => ['required', 'integer', 'between:1,7'],
            'slots.*.start_time' => ['required', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'slots.*.end_time' => ['required', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'slots.present' => 'El arreglo slots es obligatorio (puede ir vacío para limpiar el horario).',
            'slots.array' => 'El formato de slots debe ser una lista.',
            'slots.max' => 'No puedes registrar más de 35 franjas horarias en total.',
            'slots.*.weekday.required' => 'El día de la semana es obligatorio en cada franja.',
            'slots.*.weekday.integer' => 'El día de la semana debe ser un número entero del 1 (lunes) al 7 (domingo).',
            'slots.*.weekday.between' => 'El día de la semana debe estar entre 1 (lunes) y 7 (domingo).',
            'slots.*.start_time.required' => 'La hora de inicio es obligatoria.',
            'slots.*.start_time.regex' => 'La hora de inicio debe tener formato HH:MM de 24 horas.',
            'slots.*.end_time.required' => 'La hora de fin es obligatoria.',
            'slots.*.end_time.regex' => 'La hora de fin debe tener formato HH:MM de 24 horas.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            /** @var array<int, array{weekday: int|string, start_time: string, end_time: string}> $slots */
            $slots = $this->input('slots', []);
            if ($slots === []) {
                return;
            }

            /** @var array<int, array<int, array{index: int, start: int, end: int}>> $byDay */
            $byDay = [];

            foreach ($slots as $index => $slot) {
                $weekday = (int) $slot['weekday'];
                $startMinutes = $this->toMinutes((string) $slot['start_time']);
                $endMinutes = $this->toMinutes((string) $slot['end_time']);

                if ($endMinutes <= $startMinutes) {
                    $validator->errors()->add(
                        "slots.{$index}.end_time",
                        'La hora de fin debe ser mayor que la hora de inicio.'
                    );
                    continue;
                }

                if (($endMinutes - $startMinutes) < self::MIN_DURATION_MINUTES) {
                    $validator->errors()->add(
                        "slots.{$index}.end_time",
                        'La duración mínima de cada franja es de 30 minutos.'
                    );
                    continue;
                }

                $byDay[$weekday][] = [
                    'index' => (int) $index,
                    'start' => $startMinutes,
                    'end' => $endMinutes,
                ];
            }

            foreach ($byDay as $weekday => $daySlots) {
                if (count($daySlots) > self::MAX_SLOTS_PER_DAY) {
                    $validator->errors()->add(
                        'slots',
                        "No se permiten más de 5 franjas horarias en el día {$weekday}."
                    );
                }

                usort($daySlots, static fn (array $a, array $b): int => $a['start'] <=> $b['start']);

                $totalDay = count($daySlots);
                for ($i = 0; $i < $totalDay - 1; $i++) {
                    $current = $daySlots[$i];
                    $next = $daySlots[$i + 1];

                    // Franjas contiguas (next.start === current.end) sí son válidas; solo falla si next.start < current.end
                    if ($next['start'] < $current['end']) {
                        $validator->errors()->add(
                            "slots.{$next['index']}.start_time",
                            "La franja horaria se traslapa con otra del mismo día ({$weekday})."
                        );
                    }
                }
            }
        });
    }

    private function toMinutes(string $time): int
    {
        [$hours, $minutes] = array_map('intval', explode(':', $time));

        return ($hours * 60) + $minutes;
    }
}