<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Enums\ServiceRequestStatus;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

class ListServiceRequestsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $allowedStatuses = array_column(ServiceRequestStatus::cases(), 'value');

        return [
            'status' => [
                'nullable',
                'string',
                function (string $attribute, mixed $value, Closure $fail) use ($allowedStatuses): void {
                    if (!is_string($value) || trim($value) === '') {
                        return;
                    }

                    $items = array_map('trim', explode(',', $value));
                    foreach ($items as $item) {
                        if ($item === '' || !in_array($item, $allowedStatuses, true)) {
                            $fail("El estado '{$item}' no es válido.");
                            return;
                        }
                    }
                },
            ],
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
            'per_page.max' => 'El máximo de resultados por página es 24.',
        ];
    }
}