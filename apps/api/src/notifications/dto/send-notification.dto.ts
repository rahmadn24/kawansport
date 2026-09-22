import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export type NotificationDataType =
  | 'venue'
  | 'booking'
  | 'chat'
  | 'event'
  | 'system';

export class NotificationDataDto {
  @IsIn(['venue', 'booking', 'chat', 'event', 'system'])
  type!: NotificationDataType;

  @IsOptional()
  @IsUUID()
  entityId?: string;
}

export class SendNotificationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  userIds!: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationDataDto)
  data?: NotificationDataDto;
}
