<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SearchTechniciansRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merged = [];

        if ($this->has('q') && is_string($this->q)) {
            $merged['q'] = trim($this->q);
        }

        if ($this->has('zone') && is_string($this->zone)) {
            $merged['zone'] = trim($this->zone);
        }

        if ($this->has('specialty') && is_string($this->specialty)) {
            $merged['specialty'] = trim($this->specialty);
        }

        if ($this->has('sort') && is_string($this->sort)) {
            $merged['sort'] = trim($this->sort);
        }

        if ($merged !== []) {
            $this->merge($merged);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'specialty_id' => ['nullable', 'integer', 'min:1'],
            'specialty' => ['nullable', 'string', 'max:100'],
            'q' => ['nullable', 'string', 'min:2', 'max:80'],
            'zone' => ['nullable', 'string', 'min:1', 'max:150'],
            'lat' => ['nullable', 'numeric', 'between:-90,90', 'required_with:lng'],
            'lng' => ['nullable', 'numeric', 'between:-180,180', 'required_with:lat'],
            'radius_km' => ['nullable', 'numeric', 'min:1', 'max:100'],
            'available_on' => [
                'nullable',
                'date_format:Y-m-d',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (!is_string($value)) {
                        return;
                    }

                    $date = Carbon::createFromFormat('Y-m-d', $value)?->startOfDay();
                    if ($date === null || $date->format('Y-m-d') !== $value) {
                        $fail('La fecha de disponibilidad no es válida.');
                        return;
                    }

                    $today = Carbon::today();
                    $maxDate = Carbon::today()->addDays(90);

                    if ($date->lt($today)) {
                        $fail('La fecha de disponibilidad debe ser hoy o futura.');
                    } elseif ($date->gt($maxDate)) {
                        $fail('La fecha de disponibilidad no puede superar 90 días adelante.');
                    }
                },
            ],
            'available_at' => [
                'nullable',
                'regex:/^([01]\d|2[0-3]):[0-5]\d$/',
            ],
            'sort' => ['nullable', 'string', Rule::in(['distance', 'rating', 'experience', 'recent'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:24'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'q.min' => 'El texto de búsqueda debe tener al menos 2 caracteres.',
            'q.max' => 'El texto de búsqueda no puede exceder 80 caracteres.',
            'lat.between' => 'La latitud debe estar entre -90 y 90.',
            'lng.between' => 'La longitud debe estar entre -180 y 180.',
            'lat.required_with' => 'Debes proporcionar lat y lng juntos.',
            'lng.required_with' => 'Debes proporcionar lat y lng juntos.',
            'radius_km.min' => 'El radio de búsqueda mínimo es 1 km.',
            'radius_km.max' => 'El radio de búsqueda máximo es 100 km.',
            'available_on.date_format' => 'La fecha debe tener formato YYYY-MM-DD.',
            'available_at.regex' => 'La hora debe tener formato HH:MM de 24 horas.',
            'sort.in' => 'El criterio de ordenamiento debe ser distance, rating, experience o recent.',
            'per_page.max' => 'El máximo de resultados por página es 24.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->filled('available_at') && !$this->filled('available_on')) {
                $validator->errors()->add(
                    'available_at',
                    'Debes indicar available_on junto con available_at.'
                );
            }

            if ($this->input('sort') === 'distance' && (!$this->filled('lat') || !$this->filled('lng'))) {
                $validator->errors()->add(
                    'sort',
                    'Para ordenar por distancia (sort=distance) debes proporcionar lat y lng.'
                );
            }
        });
    }
}