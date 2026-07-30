import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { AuthUser } from '../../common/types/auth';
import { UserRole } from '../../common/types/auth';
import { PrismaService } from '../../prisma/prisma.service';

type CreateListingInput = {
  title: string;
  description: string;
  location: string;
  pricePerNight: number;
  currency: 'NGN' | 'USD';
  rooms: number;
  bathrooms: number;
  type: 'House' | 'Apartment';
  images: string[];
  amenities: string[];
  rules: string[];
};

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(params: {
    q?: string;
    location?: string;
    minPrice?: number;
    maxPrice?: number;
    type?: string;
    rooms?: number;
  }) {
    const q = params.q?.trim();
    const location = params.location?.trim();
    const listingType =
      params.type === 'House' || params.type === 'Apartment'
        ? params.type
        : undefined;

    return await this.prisma.listing.findMany({
      where: {
        status: 'APPROVED',
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { location: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(location ? { location: { contains: location, mode: 'insensitive' } } : {}),
        ...(listingType ? { type: listingType } : {}),
        ...(params.rooms ? { rooms: { gte: params.rooms } } : {}),
        ...(params.minPrice != null ? { pricePerNight: { gte: params.minPrice } } : {}),
        ...(params.maxPrice != null ? { pricePerNight: { lte: params.maxPrice } } : {}),
      },
      select: {
        id: true,
        title: true,
        location: true,
        pricePerNight: true,
        currency: true,
        rooms: true,
        bathrooms: true,
        type: true,
        images: true,
        amenities: true,
        status: true,
        owner: { select: { id: true, name: true, phone: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listMine(owner: AuthUser) {
    if (owner.role !== UserRole.LANDLORD) {
      throw new ForbiddenException('only landlords can view their listings');
    }

    return await this.prisma.listing.findMany({
      where: { ownerId: owner.id },
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, name: true, phone: true, email: true } },
      },
    });
  }

  async getById(id: string, viewer?: AuthUser | null) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, phone: true, email: true } },
      },
    });

    if (!listing) throw new NotFoundException('listing not found');

    if (listing.status !== 'APPROVED') {
      if (!viewer) throw new NotFoundException('listing not found');
      if (viewer.role !== UserRole.ADMIN && viewer.id !== listing.ownerId) {
        throw new NotFoundException('listing not found');
      }
    }

    return listing;
  }

  async create(owner: AuthUser, input: CreateListingInput) {
    if (owner.role !== UserRole.LANDLORD) {
      throw new ForbiddenException('only landlords can create listings');
    }

    if (!input.title.trim() || !input.location.trim() || input.pricePerNight <= 0) {
      throw new BadRequestException('invalid listing fields');
    }

    return await this.prisma.listing.create({
      data: {
        ownerId: owner.id,
        status: 'PENDING',
        title: input.title.trim(),
        description: input.description.trim(),
        location: input.location.trim(),
        pricePerNight: Math.round(input.pricePerNight),
        currency: input.currency,
        rooms: Math.max(0, Math.round(input.rooms)),
        bathrooms: Math.max(0, Math.round(input.bathrooms)),
        type: input.type,
        images: input.images,
        amenities: input.amenities,
        rules: input.rules,
      },
    });
  }

  async update(owner: AuthUser, id: string, patch: Partial<CreateListingInput>) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('listing not found');
    if (owner.role !== UserRole.ADMIN && owner.id !== listing.ownerId) {
      throw new ForbiddenException('not allowed');
    }

    return await this.prisma.listing.update({
      where: { id },
      data: {
        ...(patch.title != null ? { title: patch.title.trim() } : {}),
        ...(patch.description != null ? { description: patch.description.trim() } : {}),
        ...(patch.location != null ? { location: patch.location.trim() } : {}),
        ...(patch.pricePerNight != null ? { pricePerNight: Math.round(patch.pricePerNight) } : {}),
        ...(patch.currency != null ? { currency: patch.currency } : {}),
        ...(patch.rooms != null ? { rooms: Math.max(0, Math.round(patch.rooms)) } : {}),
        ...(patch.bathrooms != null ? { bathrooms: Math.max(0, Math.round(patch.bathrooms)) } : {}),
        ...(patch.type != null ? { type: patch.type } : {}),
        ...(patch.images != null ? { images: patch.images } : {}),
        ...(patch.amenities != null ? { amenities: patch.amenities } : {}),
        ...(patch.rules != null ? { rules: patch.rules } : {}),
        status: owner.role === UserRole.ADMIN ? listing.status : 'PENDING',
      },
    });
  }

  async remove(owner: AuthUser, id: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('listing not found');
    if (owner.role !== UserRole.ADMIN && owner.id !== listing.ownerId) {
      throw new ForbiddenException('not allowed');
    }

    await this.prisma.listing.delete({ where: { id } });
    return { success: true };
  }

  async setStatus(admin: AuthUser, id: string, status: 'APPROVED' | 'REJECTED') {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('admin only');
    }
    return await this.prisma.listing.update({
      where: { id },
      data: { status },
    });
  }
}
