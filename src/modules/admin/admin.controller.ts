import { BadRequestException, Body, Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';

import { AuthUserParam } from '../../common/decorators/auth-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthUser } from '../../common/types/auth';
import { UserRole } from '../../common/types/auth';

import { AdminService } from './admin.service';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('invalid body');
  }
  return value as Record<string, unknown>;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  async stats(@AuthUserParam() user: AuthUser) {
    return await this.admin.stats(user);
  }

  @Get('users')
  async users(@AuthUserParam() user: AuthUser) {
    return await this.admin.users(user);
  }

  @Get('users/:id')
  async user(@AuthUserParam() user: AuthUser, @Param('id') id: string) {
    return await this.admin.user(user, id);
  }

  @Get('listings')
  async listings(@AuthUserParam() user: AuthUser) {
    return await this.admin.listings(user);
  }

  @Get('bookings')
  async bookings(@AuthUserParam() user: AuthUser) {
    return await this.admin.bookings(user);
  }

  @Patch('users/:id/status')
  async setUserStatus(
    @AuthUserParam() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const data = asRecord(body);
    const status = data.status;
    if (status !== 'ACTIVE' && status !== 'SUSPENDED') {
      throw new BadRequestException('status must be ACTIVE or SUSPENDED');
    }
    return await this.admin.setUserStatus(user, id, status);
  }
}
