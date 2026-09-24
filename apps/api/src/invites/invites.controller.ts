import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateInviteDto } from './dto/create-invite.dto';
import { ListInvitesDto } from './dto/list-invites.dto';
import { InvitesService } from './invites.service';

@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateInviteDto) {
    return this.invites.create(user.id, dto);
  }

  @Get('me')
  listMine(@CurrentUser() user: { id: string }, @Query() query: ListInvitesDto) {
    return this.invites.listMine(user.id, query.dir);
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(@CurrentUser() user: { id: string }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.invites.accept(user.id, id);
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(@CurrentUser() user: { id: string }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.invites.decline(user.id, id);
  }
}
