import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** POST /sellers — user mana pun (auth) boleh apply jadi seller. */
export class CreateSellerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  shopName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
