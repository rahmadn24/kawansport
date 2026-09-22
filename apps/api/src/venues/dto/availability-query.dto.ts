import { IsNotEmpty, IsString, Matches } from 'class-validator';

/** GET /courts/:id/availability?date=YYYY-MM-DD */
export class AvailabilityQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be YYYY-MM-DD',
  })
  date!: string;
}
