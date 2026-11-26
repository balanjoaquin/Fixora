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
        Schema::create('technician_profiles', function (Blueprint $table): void {
            $table->engine = 'InnoDB';
            $table->charset = 'utf8mb4';
            $table->collation = 'utf8mb4_unicode_ci';

            $table->id();
            $table->foreignId('user_id')
                ->unique()
                ->constrained('users')
                ->restrictOnDelete();
            $table->string('headline', 120)->nullable();
            $table->text('bio')->nullable();
            $table->unsignedTinyInteger('years_experience')->default(0);
            $table->string('service_zone', 120)->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->unsignedSmallInteger('service_radius_km')->nullable();
            $table->boolean('is_visible')->default(false);
            $table->timestamp('verified_at')->nullable();
            $table->decimal('rating_avg', 3, 2)->default(0);
            $table->unsignedInteger('rating_count')->default(0);
            $table->unsignedInteger('completed_count')->default(0);
            $table->timestamps();

            $table->index(['is_visible', 'latitude', 'longitude'], 'idx_tech_profiles_visible_coords');
            $table->index('service_zone', 'idx_tech_profiles_service_zone');
            $table->index(['is_visible', 'rating_avg'], 'idx_tech_profiles_visible_rating');
        });

        DB::statement('ALTER TABLE technician_profiles ADD CONSTRAINT chk_tech_profiles_latitude CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90))');
        DB::statement('ALTER TABLE technician_profiles ADD CONSTRAINT chk_tech_profiles_longitude CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))');
    }

    public function down(): void
    {
        Schema::dropIfExists('technician_profiles');
    }
};