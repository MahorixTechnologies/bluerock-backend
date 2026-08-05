import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthUser } from '../../common/types/auth';
import { UserRole } from '../../common/types/auth';
import { PrismaService } from '../../prisma/prisma.service';

function parseDate(value: string): Date {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new BadRequestException('dates must be YYYY-MM-DD');
  }
  const [y, m, d] = trimmed.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new BadRequestException('invalid date');
  }
  return dt;
}

function diffNights(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createBooking(
    renter: AuthUser,
    params: { listingId: string; startDate: string; endDate: string },
  ) {
    if (renter.role !== UserRole.RENTER) {
      throw new ForbiddenException('renters only');
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: params.listingId },
    });
    if (!listing || (listing.status !== 'APPROVED' && listing.status !== 'Published')) {
      throw new NotFoundException('listing not found');
    }

    const start = parseDate(params.startDate);
    const end = parseDate(params.endDate);
    const nights = diffNights(start, end);
    if (nights <= 0) throw new BadRequestException('endDate must be after startDate');

    const overlapping = await this.prisma.booking.findFirst({
      where: {
        listingId: listing.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        NOT: {
          OR: [{ endDate: { lte: start } }, { startDate: { gte: end } }],
        },
      },
      select: { id: true },
    });
    if (overlapping) {
      throw new BadRequestException('selected dates are not available');
    }

    const subtotal = nights * listing.pricePerNight;
    const serviceFee = Math.round(subtotal * 0.1);
    const total = subtotal + serviceFee;

    return await this.prisma.booking.create({
      data: {
        listingId: listing.id,
        renterId: renter.id,
        startDate: start,
        endDate: end,
        nights,
        subtotal,
        serviceFee,
        total,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
      },
      include: {
        listing: { select: { id: true, title: true, location: true, currency: true, pricePerNight: true } },
      },
    });
  }

  async listMyBookings(user: AuthUser) {
    if (user.role !== UserRole.RENTER) {
      throw new ForbiddenException('renters only');
    }
    return await this.prisma.booking.findMany({
      where: { renterId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: { select: { id: true, title: true, location: true, currency: true, pricePerNight: true } },
      },
    });
  }

  async listOwnerBookings(owner: AuthUser) {
    if (owner.role !== UserRole.LANDLORD) {
      throw new ForbiddenException('landlords only');
    }
    return await this.prisma.booking.findMany({
      where: { listing: { ownerId: owner.id } },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: { select: { id: true, title: true, location: true } },
        renter: { select: { id: true, email: true, name: true, phone: true } },
      },
    });
  }

  async decideBooking(owner: AuthUser, bookingId: string, decision: 'ACCEPT' | 'REJECT') {
    if (owner.role !== UserRole.LANDLORD) {
      throw new ForbiddenException('landlords only');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: true },
    });
    if (!booking) throw new NotFoundException('booking not found');
    if (booking.listing.ownerId !== owner.id) {
      throw new ForbiddenException('not allowed');
    }

    const nextStatus = decision === 'ACCEPT' ? 'CONFIRMED' : 'REJECTED';
    return await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: nextStatus },
    });
  }

  async markPaid(renter: AuthUser, bookingId: string) {
    if (renter.role !== UserRole.RENTER) {
      throw new ForbiddenException('renters only');
    }

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('booking not found');
    if (booking.renterId !== renter.id) {
      throw new ForbiddenException('not allowed');
    }

    return await this.prisma.booking.update({
      where: { id: bookingId },
      data: { paymentStatus: 'PAID', status: booking.status === 'PENDING' ? 'CONFIRMED' : booking.status },
    });
  }
}
