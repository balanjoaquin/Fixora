<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTechnicianServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === UserRole::Technician;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'title' => is_string($this->title) ? trim($this->title) : $this->title,
            'description' => is_string($this->description) ? trim($this->description) : $this->description,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'specialty_id' => [
                'required',
                'integer',
                Rule::exists('specialties', 'id')->where(fn ($query) => $query->where('is_active', true)),
            ],
            'title' => ['required', 'string', 'min:3', 'max:150'],
            'description' => ['nullable', 'string', 'max:1500'],
            'reference_price' => ['nullable', 'numeric', 'min:0', 'max:999999.99'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'specialty_id.required' => 'Selecciona la especialidad del servicio.',
            'specialty_id.exists' => 'La especialidad seleccionada no existe o está inactiva.',
            'title.required' => 'El nombre del servicio es obligatorio.',
            'title.min' => 'El nombre del servicio debe tener al menos 3 caracteres.',
            'reference_price.numeric' => 'El precio de referencia debe ser numérico.',
            'reference_price.min' => 'El precio de referencia no puede ser negativo.',
        ];
    }
}