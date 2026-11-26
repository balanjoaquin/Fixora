<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_requests', function (Blueprint $table): void {
            $table->engine = 'InnoDB';
            $table->charset = 'utf8mb4';
            $table->collation = 'utf8mb4_unicode_ci';

            $table->id();
            $table->foreignId('client_id')
                ->constrained('users')
                ->restrictOnDelete();
            $table->foreignId('technician_profile_id')
                ->constrained('technician_profiles')
                ->restrictOnDelete();
            $table->foreignId('specialty_id')
                ->constrained('specialties')
                ->restrictOnDelete();
            $table->foreignId('technician_service_id')
                ->nullable()
                ->constrained('technician_services')
                ->restrictOnDelete();
            $table->string('title', 120);
            $table->text('description');
            $table->string('address_line', 255);
            $table->string('approx_zone', 120);
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->date('preferred_date');
            $table->time('preferred_start');
            $table->string('status', 20);
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('closed_by')
                ->nullable()
                ->constrained('users')
                ->restrictOnDelete();
            $table->string('closing_reason', 255)->nullable();
            $table->timestamps();

            $table->index(['client_id', 'status'], 'idx_service_requests_client_status');
            $table->index(['technician_profile_id', 'status'], 'idx_service_requests_tech_status');
            $table->index(['status', 'expires_at'], 'idx_service_requests_status_expires');
        });

        DB::statement("ALTER TABLE service_requests ADD CONSTRAINT chk_service_requests_status CHECK (status IN ('pending', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled', 'expired'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('service_requests');
    }
};