<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('specialty_technician', function (Blueprint $table): void {
            $table->engine = 'InnoDB';
            $table->charset = 'utf8mb4';
            $table->collation = 'utf8mb4_unicode_ci';

            $table->foreignId('technician_profile_id')
                ->constrained('technician_profiles')
                ->cascadeOnDelete();
            $table->foreignId('specialty_id')
                ->constrained('specialties')
                ->restrictOnDelete();

            $table->primary(['technician_profile_id', 'specialty_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('specialty_technician');
    }
};