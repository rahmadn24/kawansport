import { IsUUID } from 'class-validator';

export class CreateConversationDto {
  /** Id user lawan bicara. Tidak boleh sama dengan diri sendiri. */
  @IsUUID()
  partnerId!: string;
}
