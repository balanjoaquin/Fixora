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
        Schema::create('request_events', function (Blueprint $table): void {
            $table->engine = 'InnoDB';
            $table->charset = 'utf8mb4';
            $table->collation = 'utf8mb4_unicode_ci';

            $table->id();
            $table->foreignId('service_request_id')
                ->constrained('service_requests')
                ->restrictOnDelete();
            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20);
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('actor_role', 20);
            $table->string('reason', 255)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['service_request_id', 'created_at'], 'idx_request_events_request_created');
        });

        DB::statement("ALTER TABLE request_events ADD CONSTRAINT chk_request_events_actor_role CHECK (actor_role IN ('client', 'technician', 'system'))");

        DB::unprepared(<<<'SQL'
CREATE TRIGGER trg_request_events_before_update
BEFORE UPDATE ON request_events
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'request_events es una tabla de solo inserción: UPDATE prohibido.';
END
SQL);

        DB::unprepared(<<<'SQL'
CREATE TRIGGER trg_request_events_before_delete
BEFORE DELETE ON request_events
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'request_events es una tabla de solo inserción: DELETE prohibido.';
END
SQL);
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS trg_request_events_before_delete');
        DB::unprepared('DROP TRIGGER IF EXISTS trg_request_events_before_update');
        Schema::dropIfExists('request_events');
    }
};