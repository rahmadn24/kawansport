import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateInviteDto {
  @IsUUID()
  toUserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  sport?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;
}
