<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Enums\ServiceRequestStatus;
use App\Models\ServiceRequest;
use Illuminate\Foundation\Http\FormRequest;

class TransitionServiceRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('reason') && is_string($this->input('reason'))) {
            $trimmed = trim($this->input('reason'));
            $this->merge([
                'reason' => $trimmed === '' ? null : $trimmed,
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $action = (string) $this->route()?->getActionMethod();
        /** @var ServiceRequest|null $serviceRequest */
        $serviceRequest = $this->route('serviceRequest');

        $requiresReason = false;

        if ($action === 'reject') {
            $requiresReason = true;
        } elseif ($action === 'cancel' && $serviceRequest instanceof ServiceRequest) {
            $requiresReason = in_array($serviceRequest->status, [
                ServiceRequestStatus::Accepted,
                ServiceRequestStatus::InProgress,
            ], true);
        }

        return [
            'reason' => $requiresReason
                ? ['required', 'string', 'min:3', 'max:500']
                : ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'El motivo es obligatorio para realizar esta acción.',
            'reason.min' => 'El motivo debe tener al menos 3 caracteres.',
            'reason.max' => 'El motivo no puede superar los 500 caracteres.',
        ];
    }
}