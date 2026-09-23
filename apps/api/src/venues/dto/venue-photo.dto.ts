import { IsNotEmpty, IsString } from 'class-validator';
import { IsPhotoUrl } from '../../uploads/photo-url';

/** Body tambah/hapus satu foto venue (ST-01). */
export class VenuePhotoDto {
  @IsString()
  @IsNotEmpty()
  @IsPhotoUrl()
  url!: string;
}
