<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Closure;
use Illuminate\Foundation\Http\FormRequest;

class StoreReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'rating' => [
                'required',
                static function (string $attribute, mixed $value, Closure $fail): void {
                    if (is_bool($value) || filter_var($value, FILTER_VALIDATE_INT) === false) {
                        $fail('La calificación debe ser un número entero entre 1 y 5.');
                    }
                },
                'integer',
                'min:1',
                'max:5',
            ],
            'comment' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'rating.required' => 'La calificación es obligatoria.',
            'rating.integer' => 'La calificación debe ser un número entero entre 1 y 5.',
            'rating.min' => 'La calificación mínima es 1.',
            'rating.max' => 'La calificación máxima es 5.',
            'comment.string' => 'El comentario debe ser una cadena de texto.',
            'comment.max' => 'El comentario no puede superar los 1000 caracteres.',
        ];
    }
}