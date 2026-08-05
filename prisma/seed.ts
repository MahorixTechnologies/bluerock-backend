import * as bcrypt from 'bcrypt';

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureUser(params: {
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  name?: string;
  status?: 'ACTIVE' | 'SUSPENDED';
  emailVerified?: boolean;
}) {
  const email = params.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(params.password, 12);
  const status = params.status ?? 'ACTIVE';
  const emailVerified = params.emailVerified ?? true;

  return await prisma.user.upsert({
    where: { email },
    update: {
      role: params.role,
      emailVerified,
      status,
      phone: params.phone ?? null,
      name: params.name ?? null,
      passwordHash,
    },
    create: {
      email,
      passwordHash,
      role: params.role,
      emailVerified,
      status,
      phone: params.phone ?? null,
      name: params.name ?? null,
    },
    select: { id: true, email: true, role: true },
  });
}

type ListingSeed = {
  id: string;
  ownerId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  title: string;
  description: string;
  location: string;
  pricePerNight: number;
  currency: 'NGN' | 'USD';
  rooms: number;
  bathrooms: number;
  type:
    | 'EntireProperty'
    | 'Apartment'
    | 'House'
    | 'Duplex'
    | 'Studio'
    | 'SingleRoom'
    | 'SharedRoom'
    | 'Hostel'
    | 'StudentHousing'
    | 'HotelRoom'
    | 'Other';
  imageSeed: string;
  amenities: string[];
  rules: string[];
};

async function ensureListing(data: ListingSeed) {
  const { imageSeed, ...rest } = data;
  const payload = {
    ...rest,
    images: [`https://picsum.photos/seed/${imageSeed}/800/500`],
  };
  return await prisma.listing.upsert({
    where: { id: data.id },
    update: payload,
    create: payload,
    select: {
      id: true,
      title: true,
      location: true,
      pricePerNight: true,
      currency: true,
      ownerId: true,
    },
  });
}

async function main() {
  const admin = await ensureUser({
    email: 'admin@bluerock.com',
    password: 'admin123',
    role: UserRole.ADMIN,
    name: 'BlueRock Admin',
  });

  const landlord = await ensureUser({
    email: 'landlord@bluerock.com',
    password: 'landlord123',
    role: UserRole.LANDLORD,
    phone: '+2348123456789',
    name: 'BlueRock Landlord',
  });

  const landlord2 = await ensureUser({
    email: 'landlord2@bluerock.com',
    password: 'landlord123',
    role: UserRole.LANDLORD,
    phone: '+2348030000000',
    name: 'BlueRock Landlord 2',
  });

  const renter = await ensureUser({
    email: 'renter@bluerock.com',
    password: 'renter123',
    role: UserRole.RENTER,
    name: 'BlueRock Renter',
  });

  const renter2 = await ensureUser({
    email: 'renter2@bluerock.com',
    password: 'renter123',
    role: UserRole.RENTER,
    name: 'BlueRock Renter 2',
    emailVerified: false,
  });

  const suspended = await ensureUser({
    email: 'suspended@bluerock.com',
    password: 'renter123',
    role: UserRole.RENTER,
    name: 'Suspended User',
    status: 'SUSPENDED',
  });

  const listingDefinitions: ListingSeed[] = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      ownerId: landlord.id,
      status: 'APPROVED',
      title: 'Modern 2BR Apartment',
      description:
        'A clean, bright 2 bedroom apartment near the city center with open kitchen, large windows, and modern finishes.',
      location: 'Lekki, Lagos',
      pricePerNight: 45000,
      currency: 'NGN',
      rooms: 2,
      bathrooms: 2,
      type: 'Apartment',
      imageSeed: 'bluerock-apt',
      amenities: ['WiFi', 'Air conditioning', 'Kitchen', 'Parking', '24/7 Security'],
      rules: ['No smoking', 'No parties'],
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      ownerId: landlord.id,
      status: 'APPROVED',
      title: 'Cozy 3BR House with Garden',
      description:
        'A spacious three-bedroom family home featuring a private garden, sunlit living areas, secure driveway, and quiet residential street.',
      location: 'Ikeja, Lagos',
      pricePerNight: 75000,
      currency: 'NGN',
      rooms: 3,
      bathrooms: 3,
      type: 'House',
      imageSeed: 'bluerock-cozy-3br-house',
      amenities: ['Parking', 'Generator', 'Security', 'Garden', 'WiFi', 'Kitchen'],
      rules: ['No pets', 'No parties'],
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      ownerId: landlord2.id,
      status: 'PENDING',
      title: 'Studio Apartment (City View)',
      description:
        'A compact, efficient studio with panoramic city views, built-in workstation, premium finishes, and easy access to transit lines and restaurants.',
      location: 'Yaba, Lagos',
      pricePerNight: 30000,
      currency: 'NGN',
      rooms: 1,
      bathrooms: 1,
      type: 'Studio',
      imageSeed: 'bluerock-studio-city-view',
      amenities: ['WiFi', 'Workspace', 'City view', 'Air conditioning'],
      rules: ['No smoking'],
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      ownerId: landlord.id,
      status: 'APPROVED',
      title: 'Aurora Retreat',
      description:
        'A refined multi-level home with warm wood finishes, tropical landscaping, infinity pool, cinema room, and quiet luxury overlooking the lagoon.',
      location: 'Banana Island, Lagos',
      pricePerNight: 3500000,
      currency: 'NGN',
      rooms: 5,
      bathrooms: 6,
      type: 'House',
      imageSeed: 'bluerock-aurora-house',
      amenities: [
        'Infinity pool',
        'Cinema room',
        'Smart home',
        'Private chef kitchen',
        'Security',
      ],
      rules: ['No smoking', 'No parties', 'Government ID required'],
    },
    {
      id: '00000000-0000-0000-0000-000000000005',
      ownerId: landlord2.id,
      status: 'APPROVED',
      title: 'Palmview Estate',
      description:
        'A sculpted modern villa with tropical gardens, curved architecture, sunset entertaining spaces, pool terrace, and fire pit.',
      location: 'Epe, Lagos',
      pricePerNight: 1500,
      currency: 'USD',
      rooms: 4,
      bathrooms: 4,
      type: 'House',
      imageSeed: 'bluerock-palmview-house',
      amenities: ['Pool terrace', 'Fire pit', 'Outdoor lounge', 'Backup power'],
      rules: ['No pets', 'No events'],
    },
    {
      id: '00000000-0000-0000-0000-000000000006',
      ownerId: landlord2.id,
      status: 'PENDING',
      title: 'The Courtyard Villa',
      description:
        'A generous family house centered around a private courtyard, plunge pool, and shaded outdoor dining with full housekeeping support.',
      location: 'Asokoro, Abuja',
      pricePerNight: 280000,
      currency: 'NGN',
      rooms: 4,
      bathrooms: 5,
      type: 'House',
      imageSeed: 'bluerock-courtyard-villa',
      amenities: [
        'Private courtyard',
        'Pool',
        'Housekeeping',
        'Parking',
        'Security',
      ],
      rules: ['No parties', 'Quiet hours after 10pm'],
    },
    {
      id: '00000000-0000-0000-0000-000000000007',
      ownerId: landlord.id,
      status: 'APPROVED',
      title: 'Harbor Glass Loft',
      description:
        'A sculptural glass-walled loft with double-height ceilings, harbor-facing balcony, premium appliances, and designer lighting throughout.',
      location: 'Victoria Island, Lagos',
      pricePerNight: 520000,
      currency: 'NGN',
      rooms: 2,
      bathrooms: 2,
      type: 'Apartment',
      imageSeed: 'bluerock-harbor-glass-loft',
      amenities: [
        'Balcony',
        'Gym',
        'Concierge',
        'WiFi',
        'Smart home',
        'Parking',
      ],
      rules: ['No parties', 'No smoking'],
    },
    {
      id: '00000000-0000-0000-0000-000000000008',
      ownerId: landlord2.id,
      status: 'APPROVED',
      title: 'Skyline Nest',
      description:
        'A high-rise urban retreat with wraparound skyline views, rooftop pool access, gym, and a short walk to restaurants and cafés.',
      location: 'Eko Atlantic, Lagos',
      pricePerNight: 980,
      currency: 'USD',
      rooms: 2,
      bathrooms: 2,
      type: 'Apartment',
      imageSeed: 'bluerock-skyline-nest',
      amenities: ['Rooftop pool', 'Gym', 'Concierge', 'City view', 'WiFi'],
      rules: ['No smoking', 'No pets', 'No parties'],
    },
    {
      id: '00000000-0000-0000-0000-000000000009',
      ownerId: landlord.id,
      status: 'APPROVED',
      title: 'Savana Ridge Home',
      description:
        'A tranquil hillside residence nestled into natural terrain with panoramic ridgeline views, outdoor fire lounge, and infinity-edge plunge pool.',
      location: 'Maitama, Abuja',
      pricePerNight: 410000,
      currency: 'NGN',
      rooms: 4,
      bathrooms: 4,
      type: 'House',
      imageSeed: 'bluerock-savana-ridge-home',
      amenities: [
        'Plunge pool',
        'Fire lounge',
        'Terrace',
        'Backup power',
        'Security',
      ],
      rules: ['No loud events', 'No smoking inside'],
    },
    {
      id: '00000000-0000-0000-0000-000000000010',
      ownerId: landlord2.id,
      status: 'APPROVED',
      title: 'Marina Pearl Residences',
      description:
        'Waterfront luxury apartments with private marina access, yacht parking, 24/7 concierge, rooftop lounge, and panoramic waterside terraces.',
      location: 'Ikoyi, Lagos',
      pricePerNight: 650000,
      currency: 'NGN',
      rooms: 3,
      bathrooms: 3,
      type: 'EntireProperty',
      imageSeed: 'bluerock-marina-pearl-residences',
      amenities: [
        'Marina',
        'Concierge',
        'Rooftop lounge',
        'Waterfront terrace',
        'Gym',
        'Parking',
      ],
      rules: ['No parties', 'Government ID required', 'No smoking'],
    },
  ];

  const listings = await Promise.all(listingDefinitions.map((l) => ensureListing(l)));

  const booking1Start = new Date(Date.UTC(2026, 6, 10));
  const booking1End = new Date(Date.UTC(2026, 6, 13));
  const b1Subtotal = 3 * listings[0].pricePerNight;
  const b1Fee = Math.round(b1Subtotal * 0.1);
  const b1Total = b1Subtotal + b1Fee;

  const booking1 = await prisma.booking.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000b1' },
    update: {
      listingId: listings[0].id,
      renterId: renter.id,
      startDate: booking1Start,
      endDate: booking1End,
      nights: 3,
      subtotal: b1Subtotal,
      serviceFee: b1Fee,
      total: b1Total,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
    },
    create: {
      id: '00000000-0000-0000-0000-0000000000b1',
      listingId: listings[0].id,
      renterId: renter.id,
      startDate: booking1Start,
      endDate: booking1End,
      nights: 3,
      subtotal: b1Subtotal,
      serviceFee: b1Fee,
      total: b1Total,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
    },
    select: { id: true, listingId: true, renterId: true },
  });

  const booking2Start = new Date(Date.UTC(2026, 6, 20));
  const booking2End = new Date(Date.UTC(2026, 6, 22));
  const b2Subtotal = 2 * listings[1].pricePerNight;
  const b2Fee = Math.round(b2Subtotal * 0.1);
  const b2Total = b2Subtotal + b2Fee;

  const booking2 = await prisma.booking.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000b2' },
    update: {
      listingId: listings[1].id,
      renterId: renter2.id,
      startDate: booking2Start,
      endDate: booking2End,
      nights: 2,
      subtotal: b2Subtotal,
      serviceFee: b2Fee,
      total: b2Total,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
    },
    create: {
      id: '00000000-0000-0000-0000-0000000000b2',
      listingId: listings[1].id,
      renterId: renter2.id,
      startDate: booking2Start,
      endDate: booking2End,
      nights: 2,
      subtotal: b2Subtotal,
      serviceFee: b2Fee,
      total: b2Total,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
    },
    select: { id: true, listingId: true, renterId: true },
  });

  const booking3Start = new Date(Date.UTC(2026, 6, 25));
  const booking3End = new Date(Date.UTC(2026, 6, 27));
  const b3Subtotal = 2 * listings[0].pricePerNight;
  const b3Fee = Math.round(b3Subtotal * 0.1);
  const b3Total = b3Subtotal + b3Fee;

  const booking3 = await prisma.booking.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000b3' },
    update: {
      listingId: listings[0].id,
      renterId: renter2.id,
      startDate: booking3Start,
      endDate: booking3End,
      nights: 2,
      subtotal: b3Subtotal,
      serviceFee: b3Fee,
      total: b3Total,
      status: 'REJECTED',
      paymentStatus: 'UNPAID',
    },
    create: {
      id: '00000000-0000-0000-0000-0000000000b3',
      listingId: listings[0].id,
      renterId: renter2.id,
      startDate: booking3Start,
      endDate: booking3End,
      nights: 2,
      subtotal: b3Subtotal,
      serviceFee: b3Fee,
      total: b3Total,
      status: 'REJECTED',
      paymentStatus: 'UNPAID',
    },
    select: { id: true, listingId: true, renterId: true },
  });

  const booking4Start = new Date(Date.UTC(2026, 5, 2));
  const booking4End = new Date(Date.UTC(2026, 5, 5));
  const b4Subtotal = 3 * listings[1].pricePerNight;
  const b4Fee = Math.round(b4Subtotal * 0.1);
  const b4Total = b4Subtotal + b4Fee;

  const booking4 = await prisma.booking.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000b4' },
    update: {
      listingId: listings[1].id,
      renterId: renter.id,
      startDate: booking4Start,
      endDate: booking4End,
      nights: 3,
      subtotal: b4Subtotal,
      serviceFee: b4Fee,
      total: b4Total,
      status: 'CANCELLED',
      paymentStatus: 'REFUNDED',
    },
    create: {
      id: '00000000-0000-0000-0000-0000000000b4',
      listingId: listings[1].id,
      renterId: renter.id,
      startDate: booking4Start,
      endDate: booking4End,
      nights: 3,
      subtotal: b4Subtotal,
      serviceFee: b4Fee,
      total: b4Total,
      status: 'CANCELLED',
      paymentStatus: 'REFUNDED',
    },
    select: { id: true, listingId: true, renterId: true },
  });

  const reviews = await prisma.review.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-0000000000r1',
        listingId: listings[0].id,
        renterId: renter.id,
        rating: 5,
        body: 'Very clean place, great host communication. Would stay again.',
      },
      {
        id: '00000000-0000-0000-0000-0000000000r2',
        listingId: listings[1].id,
        renterId: renter2.id,
        rating: 4,
        body: 'Nice location and spacious rooms. Check-in was smooth.',
      },
    ],
    skipDuplicates: true,
  });

  const tokens = await Promise.all([
    prisma.token.upsert({
      where: { token: 'seed-email-verify-renter2' },
      update: {
        userId: renter2.id,
        type: 'EMAIL_VERIFY',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        usedAt: null,
      },
      create: {
        token: 'seed-email-verify-renter2',
        userId: renter2.id,
        type: 'EMAIL_VERIFY',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
      select: { id: true, type: true, token: true, userId: true },
    }),
    prisma.token.upsert({
      where: { token: 'seed-password-reset-renter' },
      update: {
        userId: renter.id,
        type: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
        usedAt: new Date(),
      },
      create: {
        token: 'seed-password-reset-renter',
        userId: renter.id,
        type: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
        usedAt: new Date(),
      },
      select: { id: true, type: true, token: true, userId: true },
    }),
  ]);

  return {
    admin,
    landlord,
    landlord2,
    renter,
    renter2,
    suspended,
    listings,
    bookings: [booking1, booking2, booking3, booking4],
    reviewCount: reviews.count,
    tokens,
  };
}

main()
  .then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  })
  .catch((err) => {
    process.stderr.write(
      `${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
