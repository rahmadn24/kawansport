import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * GET /venues/:id/stats?date=YYYY-MM-DD (API-W05).
 * `date` opsional — default hari ini (UTC, string apa adanya seperti booking).
 * Validasi kalender penuh (mis. 2030-02-30) dilakukan di service
 * (assertValidDate, pola SlotsService) agar pesan 400 konsisten.
 */
export class VenueStatsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be YYYY-MM-DD',
  })
  date?: string;
}
