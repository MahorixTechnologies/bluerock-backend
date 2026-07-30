import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthUser } from '../../common/types/auth';
import { UserRole } from '../../common/types/auth';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForListing(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, status: true },
    });
    if (!listing || listing.status !== 'APPROVED') throw new NotFoundException('listing not found');

    return await this.prisma.review.findMany({
      where: { listingId },
      orderBy: { createdAt: 'desc' },
      include: { renter: { select: { id: true, name: true } } },
    });
  }

  async createForListing(
    renter: AuthUser,
    listingId: string,
    params: { rating: number; body: string },
  ) {
    if (renter.role !== UserRole.RENTER) {
      throw new ForbiddenException('renters only');
    }
    const rating = Math.round(params.rating);
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('rating must be 1-5');
    }
    const text = params.body.trim();
    if (text.length < 3) {
      throw new BadRequestException('review body is too short');
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, status: true },
    });
    if (!listing || listing.status !== 'APPROVED') throw new NotFoundException('listing not found');

    const booking = await this.prisma.booking.findFirst({
      where: {
        listingId,
        renterId: renter.id,
        paymentStatus: 'PAID',
        endDate: { lt: new Date() },
      },
      select: { id: true },
    });

    if (!booking) {
      throw new ForbiddenException('complete a stay before reviewing');
    }

    return await this.prisma.review.create({
      data: {
        listingId,
        renterId: renter.id,
        rating,
        body: text,
      },
    });
  }
}
