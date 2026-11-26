<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\TechnicianProfile;
use App\Services\ReviewService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RecalculateRatingsCommand extends Command
{
    protected $signature = 'fixora:recalculate-ratings
        {--technician= : ID del perfil técnico (technician_profiles.id) a recalcular}
        {--dry-run : Informa las diferencias encontradas sin modificar la base de datos}';

    protected $description = 'Recalcula rating_avg, rating_count y completed_count de los perfiles técnicos';

    public function handle(ReviewService $reviewService): int
    {
        $technicianOption = $this->option('technician');
        $dryRun = (bool) $this->option('dry-run');

        $query = TechnicianProfile::query()->orderBy('id');

        if ($technicianOption !== null && $technicianOption !== '') {
            $technicianId = (int) $technicianOption;
            if (!TechnicianProfile::query()->whereKey($technicianId)->exists()) {
                $this->error("No se encontró el perfil técnico con ID {$technicianId}.");

                return self::FAILURE;
            }

            $query->whereKey($technicianId);
        }

        $differencesCount = 0;

        $query->chunkById(100, function ($profiles) use ($reviewService, $dryRun, &$differencesCount): void {
            /** @var TechnicianProfile $profile */
            foreach ($profiles as $profile) {
                $expected = $reviewService->computeExpectedMetrics($profile->id);

                $currentAvg = number_format((float) $profile->rating_avg, 2, '.', '');
                $currentRatingCount = (int) $profile->rating_count;
                $currentCompletedCount = (int) $profile->completed_count;

                $hasDiff = $currentAvg !== $expected['rating_avg']
                    || $currentRatingCount !== $expected['rating_count']
                    || $currentCompletedCount !== $expected['completed_count'];

                if (!$hasDiff) {
                    continue;
                }

                $differencesCount++;

                $this->line(sprintf(
                    'Técnico #%d: rating_avg %s -> %s | rating_count %d -> %d | completed_count %d -> %d',
                    $profile->id,
                    $currentAvg,
                    $expected['rating_avg'],
                    $currentRatingCount,
                    $expected['rating_count'],
                    $currentCompletedCount,
                    $expected['completed_count'],
                ));

                if (!$dryRun) {
                    DB::transaction(function () use ($profile, $reviewService, $expected): void {
                        /** @var TechnicianProfile $locked */
                        $locked = TechnicianProfile::query()
                            ->whereKey($profile->id)
                            ->lockForUpdate()
                            ->firstOrFail();

                        $reviewService->recalculateForTechnician($locked);
                        $locked->forceFill([
                            'completed_count' => $expected['completed_count'],
                        ])->save();
                    });
                }
            }
        });

        if ($differencesCount === 0) {
            $this->info('Sin diferencias encontradas.');

            return self::SUCCESS;
        }

        if ($dryRun) {
            $this->info("Dry-run completado: {$differencesCount} perfil(es) con diferencias detectadas (sin cambios escritos).");
        } else {
            $this->info("Recálculo completado: {$differencesCount} perfil(es) actualizado(s).");
        }

        return self::SUCCESS;
    }
}