<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | URL base del frontend de FIXORA
    |--------------------------------------------------------------------------
    */
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),

    /*
    |--------------------------------------------------------------------------
    | Zona horaria operativa de FIXORA
    |--------------------------------------------------------------------------
    |
    | Todos los timestamps en base de datos se almacenan en UTC.
    | Los campos preferred_date y preferred_start representan fecha y hora
    | local en esta zona horaria; toda comparación contra "ahora" se realiza
    | convirtiendo explícitamente a esta zona.
    |
    */
    'timezone' => env('FIXORA_TIMEZONE', 'America/Mexico_City'),

    /*
    |--------------------------------------------------------------------------
    | Plazo máximo de respuesta del técnico (en horas)
    |--------------------------------------------------------------------------
    */
    'request_response_hours' => (int) env('FIXORA_REQUEST_RESPONSE_HOURS', 48),

    /*
    |--------------------------------------------------------------------------
    | Horas de anticipación para avisar vencimiento próximo al técnico
    |--------------------------------------------------------------------------
    */
    'expiry_warning_hours' => (int) env('FIXORA_EXPIRY_WARNING_HOURS', 12),

    /*
    |--------------------------------------------------------------------------
    | Horizonte máximo de agendamiento hacia el futuro (en días)
    |--------------------------------------------------------------------------
    */
    'max_days_ahead' => (int) env('FIXORA_MAX_DAYS_AHEAD', 60),

    /*
    |--------------------------------------------------------------------------
    | Vigencia de enlaces de verificación de correo y restablecimiento (min)
    |--------------------------------------------------------------------------
    */
    'verification_expire_minutes' => (int) env('FIXORA_VERIFICATION_EXPIRE_MINUTES', 60),
    'password_reset_expire_minutes' => (int) env('FIXORA_PASSWORD_RESET_EXPIRE_MINUTES', 60),

    /*
    |--------------------------------------------------------------------------
    | Retención de notificaciones en base de datos (en días)
    |--------------------------------------------------------------------------
    */
    'read_notifications_retention_days' => (int) env('FIXORA_READ_NOTIFICATIONS_RETENTION_DAYS', 90),
    'unread_notifications_retention_days' => (int) env('FIXORA_UNREAD_NOTIFICATIONS_RETENTION_DAYS', 180),
];