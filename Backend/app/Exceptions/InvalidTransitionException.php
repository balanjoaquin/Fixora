<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

class InvalidTransitionException extends RuntimeException
{
    public function __construct(string $message = 'La solicitud ya no puede cambiar de ese estado')
    {
        parent::__construct($message, 409);
    }
}