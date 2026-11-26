<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('login', function (Request $request): Limit {
            $email = strtolower((string) $request->input('email', ''));

            return Limit::perMinute(20)->by($email.'|'.$request->ip());
        });

        RateLimiter::for('forgot-password', function (Request $request): Limit {
            $email = strtolower((string) $request->input('email', ''));

            return Limit::perMinute(20)->by($email.'|'.$request->ip());
        });

        RateLimiter::for('reset-password', function (Request $request): Limit {
            $email = strtolower((string) $request->input('email', ''));

            return Limit::perMinute(20)->by($email.'|'.$request->ip());
        });

        RateLimiter::for('email-verification-resend', function (Request $request): Limit {
            $key = (string) ($request->user()?->id ?? $request->ip());

            return Limit::perMinute(30)->by($key);
        });

        RateLimiter::for('create-requests', function (Request $request): Limit {
            $key = (string) ($request->user()?->id ?? $request->ip());

            return Limit::perMinute(30)->by($key);
        });
    }
}