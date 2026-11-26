<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_requests', function (Blueprint $table): void {
            $table->timestamp('expiry_warning_sent_at')->nullable();
            $table->index(['status', 'expires_at', 'expiry_warning_sent_at'], 'sr_status_expires_warning_idx');
        });
    }

    public function down(): void
    {
        Schema::table('service_requests', function (Blueprint $table): void {
            $table->dropIndex('sr_status_expires_warning_idx');
            $table->dropColumn('expiry_warning_sent_at');
        });
    }
};