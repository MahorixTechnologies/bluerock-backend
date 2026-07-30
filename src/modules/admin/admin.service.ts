import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthUser } from '../../common/types/auth';
import { UserRole } from '../../common/types/auth';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAdmin(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('admin only');
    }
  }

  async stats(user: AuthUser) {
    this.ensureAdmin(user);
    const [users, listings, bookings, revenue] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.listing.count(),
      this.prisma.booking.count(),
      this.prisma.booking.aggregate({
        where: { paymentStatus: 'PAID' },
        _sum: { total: true },
      }),
    ]);

    return {
      users,
      listings,
      bookings,
      revenue: revenue._sum.total ?? 0,
    };
  }

  async users(user: AuthUser) {
    this.ensureAdmin(user);
    return await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        name: true,
        phone: true,
        createdAt: true,
      },
    });
  }

  async user(user: AuthUser, userId: string) {
    this.ensureAdmin(user);

    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        name: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            listings: true,
            bookings: true,
            reviews: true,
            tokens: true,
          },
        },
        listings: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            title: true,
            location: true,
            status: true,
            createdAt: true,
            pricePerNight: true,
            currency: true,
          },
        },
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            createdAt: true,
            total: true,
            status: true,
            paymentStatus: true,
            listing: {
              select: {
                id: true,
                title: true,
                location: true,
              },
            },
          },
        },
      },
    });

    if (!target) {
      throw new NotFoundException('user not found');
    }

    return {
      ...target,
      counts: {
        listingsOwned: target._count.listings,
        bookingsAsRenter: target._count.bookings,
        reviewsWritten: target._count.reviews,
        accessTokens: target._count.tokens,
      },
    };
  }

  async listings(user: AuthUser) {
    this.ensureAdmin(user);
    return await this.prisma.listing.findMany({
      orderBy: { createdAt: 'desc' },
      include: { owner: { select: { id: true, email: true, name: true, phone: true } } },
    });
  }

  async bookings(user: AuthUser) {
    this.ensureAdmin(user);
    return await this.prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        listing: { select: { id: true, title: true, location: true, ownerId: true } },
        renter: { select: { id: true, email: true, name: true, phone: true } },
      },
    });
  }

  async setUserStatus(user: AuthUser, userId: string, status: 'ACTIVE' | 'SUSPENDED') {
    this.ensureAdmin(user);
    return await this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, email: true, status: true },
    });
  }
}
