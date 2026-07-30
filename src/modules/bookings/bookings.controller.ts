import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthUserParam } from '../../common/decorators/auth-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthUser } from '../../common/types/auth';
import { UserRole } from '../../common/types/auth';

import { BookingsService } from './bookings.service';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('invalid body');
  }
  return value as Record<string, unknown>;
}

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @Roles(UserRole.RENTER)
  async create(
    @AuthUserParam() user: AuthUser,
    @Body()
    body: { listingId?: unknown; startDate?: unknown; endDate?: unknown },
  ) {
    const data = asRecord(body);
    const listingId = data.listingId;
    const startDate = data.startDate;
    const endDate = data.endDate;

    if (typeof listingId !== 'string' || listingId.trim().length === 0) {
      throw new BadRequestException('listingId is required');
    }
    if (typeof startDate !== 'string' || typeof endDate !== 'string') {
      throw new BadRequestException('startDate and endDate are required');
    }

    return await this.bookings.createBooking(user, {
      listingId,
      startDate,
      endDate,
    });
  }

  @Get('me')
  @Roles(UserRole.RENTER)
  async myBookings(@AuthUserParam() user: AuthUser) {
    return await this.bookings.listMyBookings(user);
  }

  @Get('owner')
  @Roles(UserRole.LANDLORD)
  async ownerBookings(@AuthUserParam() user: AuthUser) {
    return await this.bookings.listOwnerBookings(user);
  }

  @Patch(':id/decision')
  @Roles(UserRole.LANDLORD)
  async decide(
    @AuthUserParam() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { decision?: unknown },
  ) {
    const data = asRecord(body);
    const decision = data.decision;
    if (decision !== 'ACCEPT' && decision !== 'REJECT') {
      throw new BadRequestException('decision must be ACCEPT or REJECT');
    }
    return await this.bookings.decideBooking(user, id, decision);
  }

  @Patch(':id/pay')
  @Roles(UserRole.RENTER)
  async pay(@AuthUserParam() user: AuthUser, @Param('id') id: string) {
    return await this.bookings.markPaid(user, id);
  }
}
