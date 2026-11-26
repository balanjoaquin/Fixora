<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('technician_profiles', 'avatar_path')) {
            Schema::table('technician_profiles', function (Blueprint $table): void {
                $table->string('avatar_path', 255)->nullable()->after('bio');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('technician_profiles', 'avatar_path')) {
            Schema::table('technician_profiles', function (Blueprint $table): void {
                $table->dropColumn('avatar_path');
            });
        }
    }
};