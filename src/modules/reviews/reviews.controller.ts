import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { AuthUserParam } from '../../common/decorators/auth-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthUser } from '../../common/types/auth';
import { UserRole } from '../../common/types/auth';

import { ReviewsService } from './reviews.service';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('invalid body');
  }
  return value as Record<string, unknown>;
}

@Controller('listings/:listingId/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  async list(@Param('listingId') listingId: string) {
    return await this.reviews.listForListing(listingId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RENTER)
  async create(
    @AuthUserParam() user: AuthUser,
    @Param('listingId') listingId: string,
    @Body() body: unknown,
  ) {
    const data = asRecord(body);
    const rating = data.rating;
    const text = data.body;
    if (rating == null) throw new BadRequestException('rating is required');
    if (typeof text !== 'string') throw new BadRequestException('body is required');

    const ratingNumber =
      typeof rating === 'number' ? rating : typeof rating === 'string' ? Number(rating) : NaN;

    if (!Number.isFinite(ratingNumber)) throw new BadRequestException('rating must be a number');

    return await this.reviews.createForListing(user, listingId, {
      rating: ratingNumber,
      body: text,
    });
  }
}
