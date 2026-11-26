<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTechnicianServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === UserRole::Technician;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('title') && is_string($this->title)) {
            $this->merge(['title' => trim($this->title)]);
        }

        if ($this->has('description') && is_string($this->description)) {
            $this->merge(['description' => trim($this->description)]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'specialty_id' => [
                'sometimes',
                'required',
                'integer',
                Rule::exists('specialties', 'id')->where(fn ($query) => $query->where('is_active', true)),
            ],
            'title' => ['sometimes', 'required', 'string', 'min:3', 'max:150'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1500'],
            'reference_price' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:999999.99'],
        ];
    }
}