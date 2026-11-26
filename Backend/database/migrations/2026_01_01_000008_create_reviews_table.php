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
        Schema::create('reviews', function (Blueprint $table): void {
            $table->engine = 'InnoDB';
            $table->charset = 'utf8mb4';
            $table->collation = 'utf8mb4_unicode_ci';

            $table->id();
            $table->foreignId('service_request_id')
                ->unique()
                ->constrained('service_requests')
                ->restrictOnDelete();
            $table->foreignId('client_id')
                ->constrained('users')
                ->restrictOnDelete();
            $table->foreignId('technician_profile_id')
                ->constrained('technician_profiles')
                ->restrictOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->text('technician_reply')->nullable();
            $table->timestamp('replied_at')->nullable();
            $table->boolean('is_hidden')->default(false);
            $table->foreignId('moderated_by')
                ->nullable()
                ->constrained('users')
                ->restrictOnDelete();
            $table->string('moderation_reason', 255)->nullable();
            $table->timestamp('moderated_at')->nullable();
            $table->timestamps();

            $table->index(['technician_profile_id', 'is_hidden', 'created_at'], 'idx_reviews_tech_hidden_created');
        });

        DB::statement('ALTER TABLE reviews ADD CONSTRAINT chk_reviews_rating CHECK (rating >= 1 AND rating <= 5)');
    }

    public function down(): void
    {
        Schema::dropIfExists('reviews');
    }
};