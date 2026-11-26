<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('technician_services', function (Blueprint $table): void {
            $table->engine = 'InnoDB';
            $table->charset = 'utf8mb4';
            $table->collation = 'utf8mb4_unicode_ci';

            $table->id();
            $table->foreignId('technician_profile_id')
                ->constrained('technician_profiles')
                ->restrictOnDelete();
            $table->foreignId('specialty_id')
                ->constrained('specialties')
                ->restrictOnDelete();
            $table->string('title', 120);
            $table->text('description')->nullable();
            $table->decimal('reference_price', 10, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['technician_profile_id', 'is_active'], 'idx_tech_services_profile_active');
            $table->index('specialty_id', 'idx_tech_services_specialty');
            $table->fullText(['title', 'description'], 'ft_tech_services_title_description');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('technician_services');
    }
};