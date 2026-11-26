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
        Schema::create('availability_slots', function (Blueprint $table): void {
            $table->engine = 'InnoDB';
            $table->charset = 'utf8mb4';
            $table->collation = 'utf8mb4_unicode_ci';

            $table->id();
            $table->foreignId('technician_profile_id')
                ->constrained('technician_profiles')
                ->cascadeOnDelete();
            $table->unsignedTinyInteger('weekday');
            $table->time('start_time');
            $table->time('end_time');

            $table->unique(['technician_profile_id', 'weekday', 'start_time'], 'uq_availability_slots_profile_day_start');
        });

        DB::statement('ALTER TABLE availability_slots ADD CONSTRAINT chk_availability_slots_weekday CHECK (weekday >= 1 AND weekday <= 7)');
        DB::statement('ALTER TABLE availability_slots ADD CONSTRAINT chk_availability_slots_time_range CHECK (end_time > start_time)');
    }

    public function down(): void
    {
        Schema::dropIfExists('availability_slots');
    }
};