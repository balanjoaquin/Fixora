<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('service_requests') && !Schema::hasColumn('service_requests', 'photos')) {
            Schema::table('service_requests', function (Blueprint $table) {
                $table->json('photos')->nullable()->after('description');
            });
        }

        if (Schema::hasTable('reviews') && !Schema::hasColumn('reviews', 'photos')) {
            Schema::table('reviews', function (Blueprint $table) {
                $table->json('photos')->nullable()->after('comment');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('service_requests') && Schema::hasColumn('service_requests', 'photos')) {
            Schema::table('service_requests', function (Blueprint $table) {
                $table->dropColumn('photos');
            });
        }

        if (Schema::hasTable('reviews') && Schema::hasColumn('reviews', 'photos')) {
            Schema::table('reviews', function (Blueprint $table) {
                $table->dropColumn('photos');
            });
        }
    }
};