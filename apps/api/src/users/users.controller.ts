import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchUsersDto } from './dto/search-users.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /**
   * Cari partner sparing (SM-06): exclude diri sendiri, filter sport overlap
   * + skill, lingkaran geo ST_DWithin + sort jarak ASC, pagination + meta.
   */
  @Get('search')
  search(@CurrentUser() user: { id: string }, @Query() query: SearchUsersDto) {
    return this.users.searchUsers(user.id, query);
  }
}
