<?php

declare(strict_types=1);

namespace App\Enums;

enum ActorRole: string
{
    case Client = 'client';
    case Technician = 'technician';
    case System = 'system';
}