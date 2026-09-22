import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
  CHANGE_REQUEST_ENTITY_TYPES,
  CHANGE_REQUEST_STATUSES,
} from '../change-request.entity';

/** GET /admin/change-requests + GET /me/change-requests — semua filter opsional. */
export class ListChangeRequestsDto {
  @IsOptional()
  @IsIn(CHANGE_REQUEST_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(CHANGE_REQUEST_ENTITY_TYPES)
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
