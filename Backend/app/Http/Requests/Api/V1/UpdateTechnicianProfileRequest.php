<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;

class UpdateTechnicianProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === UserRole::Technician;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'headline' => is_string($this->headline) ? trim($this->headline) : $this->headline,
            'bio' => is_string($this->bio) ? trim($this->bio) : $this->bio,
            'service_zone' => is_string($this->service_zone) ? trim($this->service_zone) : $this->service_zone,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'headline' => ['nullable', 'string', 'max:150'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'years_experience' => ['required', 'integer', 'min:0', 'max:60'],
            'service_zone' => ['nullable', 'string', 'max:150'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:longitude'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:latitude'],
            'service_radius_km' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'years_experience.required' => 'Indica tus años de experiencia (0 si vas iniciando).',
            'years_experience.min' => 'Los años de experiencia no pueden ser negativos.',
            'years_experience.max' => 'Los años de experiencia no pueden superar 60.',
            'latitude.between' => 'La latitud debe estar entre -90 y 90.',
            'longitude.between' => 'La longitud debe estar entre -180 y 180.',
            'latitude.required_with' => 'Debes enviar latitud y longitud juntas.',
            'longitude.required_with' => 'Debes enviar latitud y longitud juntas.',
            'service_radius_km.min' => 'El radio de cobertura mínimo es 1 km.',
            'service_radius_km.max' => 'El radio de cobertura máximo es 100 km.',
        ];
    }
}