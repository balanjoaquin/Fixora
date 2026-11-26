<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SyncTechnicianSpecialtiesRequest extends FormRequest
{
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
            'specialty_ids' => ['present', 'array', 'max:10'],
            'specialty_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('specialties', 'id')->where(fn ($query) => $query->where('is_active', true)),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'specialty_ids.present' => 'El listado de especialidades es obligatorio.',
            'specialty_ids.array' => 'El formato de especialidades no es válido.',
            'specialty_ids.*.exists' => 'Una o más especialidades seleccionadas no existen o están inactivas.',
            'specialty_ids.*.distinct' => 'No repitas especialidades en la selección.',
        ];
    }
}