<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Schedule;

$fixoraTimezone = (string) config('fixora.timezone', config('app.timezone', 'America/Mexico_City'));

Schedule::command('fixora:expire-requests')
    ->everyMinute()
    ->timezone($fixoraTimezone)
    ->withoutOverlapping();

Schedule::command('fixora:notify-expiring-requests')
    ->everyFifteenMinutes()
    ->timezone($fixoraTimezone)
    ->withoutOverlapping();

Schedule::command('fixora:recalculate-ratings')
    ->dailyAt('03:00')
    ->timezone($fixoraTimezone)
    ->withoutOverlapping();

Schedule::command('sanctum:prune-expired --hours=24')
    ->daily()
    ->timezone($fixoraTimezone)
    ->withoutOverlapping();

Schedule::command('fixora:prune-notifications')
    ->daily()
    ->timezone($fixoraTimezone)
    ->withoutOverlapping();