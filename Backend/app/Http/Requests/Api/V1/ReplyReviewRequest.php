<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Services\ReviewService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ReplyReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'min:1', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'body.required' => 'El texto de la respuesta es obligatorio.',
            'body.string' => 'La respuesta debe ser una cadena de texto.',
            'body.min' => 'La respuesta debe contener al menos 1 carácter.',
            'body.max' => 'La respuesta no puede superar los 1000 caracteres.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->has('body')) {
                return;
            }

            $raw = $this->input('body');
            if (!is_string($raw) || app(ReviewService::class)->sanitizeText($raw) === null) {
                $validator->errors()->add('body', 'El texto de la respuesta no puede estar vacío.');
            }
        });
    }
}