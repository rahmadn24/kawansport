import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { IsPhotoUrl } from '../../uploads/photo-url';
import { VENUE_DOCUMENT_TYPES } from '../venue-document.entity';
import type { VenueDocumentType } from '../venue-document.entity';

/** POST /venues/:id/documents — tambah dokumen legalitas (owner / super_admin). */
export class CreateVenueDocumentDto {
  @IsString()
  @IsIn(VENUE_DOCUMENT_TYPES)
  type!: VenueDocumentType;

  @IsString()
  @IsNotEmpty()
  @IsPhotoUrl()
  url!: string;
}
