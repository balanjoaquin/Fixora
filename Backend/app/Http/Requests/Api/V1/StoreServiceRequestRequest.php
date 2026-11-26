<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

class StoreServiceRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merged = [];

        foreach (['title', 'description', 'address_line', 'approx_zone', 'preferred_date', 'preferred_start'] as $field) {
            if ($this->has($field) && is_string($this->input($field))) {
                $merged[$field] = trim($this->input($field));
            }
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
            'technician_profile_id' => ['required', 'integer', 'min:1'],
            'specialty_id' => ['required', 'integer', 'min:1'],
            'technician_service_id' => ['nullable', 'integer', 'min:1'],
            'title' => ['required', 'string', 'min:5', 'max:120'],
            'description' => ['required', 'string', 'min:10', 'max:1000'],
            'address_line' => ['required', 'string', 'min:5', 'max:255'],
            'approx_zone' => ['required', 'string', 'min:3', 'max:120'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:longitude'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:latitude'],
            'preferred_date' => [
                'required',
                'date_format:Y-m-d',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (!is_string($value)) {
                        return;
                    }

                    $parsed = Carbon::createFromFormat('Y-m-d', $value);
                    if ($parsed === false || $parsed->format('Y-m-d') !== $value) {
                        $fail('La fecha preferida no es válida.');
                    }
                },
            ],
            'preferred_start' => ['required', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'technician_profile_id.required' => 'Debes seleccionar un técnico.',
            'specialty_id.required' => 'Debes seleccionar una especialidad.',
            'title.min' => 'El título debe tener al menos 5 caracteres.',
            'title.max' => 'El título no puede superar los 120 caracteres.',
            'description.min' => 'La descripción debe tener al menos 10 caracteres.',
            'description.max' => 'La descripción no puede superar los 1000 caracteres.',
            'address_line.required' => 'La dirección exacta del servicio es obligatoria.',
            'address_line.min' => 'La dirección debe tener al menos 5 caracteres.',
            'approx_zone.required' => 'La zona aproximada es obligatoria.',
            'approx_zone.min' => 'La zona aproximada debe tener al menos 3 caracteres.',
            'latitude.required_with' => 'Debes enviar latitude y longitude juntas.',
            'longitude.required_with' => 'Debes enviar latitude y longitude juntas.',
            'preferred_date.date_format' => 'La fecha preferida debe tener el formato YYYY-MM-DD.',
            'preferred_start.regex' => 'La hora preferida debe tener el formato HH:MM de 24 horas.',
        ];
    }
}