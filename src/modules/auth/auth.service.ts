import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import type { StringValue } from 'ms';

import { UserRole } from '../../common/types/auth';
import { PrismaService } from '../../prisma/prisma.service';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function requirePassword(password: unknown) {
  if (typeof password !== 'string' || password.trim().length < 6) {
    throw new BadRequestException('password must be at least 6 characters');
  }
  return password;
}

function makeToken() {
  return randomBytes(24).toString('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(params: {
    email: string;
    password: string;
    role?: UserRole;
    phone?: string;
  }) {
    const email = normalizeEmail(params.email);
    const password = requirePassword(params.password);
    const role = params.role ?? UserRole.RENTER;

    if (
      role === UserRole.LANDLORD &&
      (!params.phone || params.phone.trim().length === 0)
    ) {
      throw new BadRequestException('phone is required for landlords');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        phone: params.phone?.trim() || null,
      },
      select: { id: true, email: true, role: true, emailVerified: true, name: true, phone: true },
    });

    const token = makeToken();
    await this.prisma.token.create({
      data: {
        userId: user.id,
        type: 'EMAIL_VERIFY',
        token,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
    });

    const accessToken = await this.signToken(
      user.id,
      user.email,
      user.role as unknown as UserRole,
    );

    return { accessToken, user, emailVerificationToken: token };
  }

  async login(params: { email: string; password: string }) {
    const email = normalizeEmail(params.email);
    const password = requirePassword(params.password);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        name: true,
        phone: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('account is suspended');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('invalid credentials');
    }

    const accessToken = await this.signToken(
      user.id,
      user.email,
      user.role as unknown as UserRole,
    );
    const { passwordHash, ...safeUser } = user;
    return { accessToken, user: safeUser };
  }

  async requestEmailVerification(emailInput: string) {
    const email = normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return { success: true };

    const token = makeToken();
    await this.prisma.token.create({
      data: {
        userId: user.id,
        type: 'EMAIL_VERIFY',
        token,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
    });

    return { success: true, emailVerificationToken: token };
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.token.findUnique({ where: { token } });
    if (!record || record.type !== 'EMAIL_VERIFY') {
      throw new BadRequestException('invalid token');
    }
    if (record.usedAt) {
      throw new BadRequestException('token already used');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('token expired');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
      }),
      this.prisma.token.update({
        where: { token },
        data: { usedAt: new Date() },
      }),
    ]);

    return { success: true };
  }

  async forgotPassword(emailInput: string) {
    const email = normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return { success: true };

    const token = makeToken();
    await this.prisma.token.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        token,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    });

    return { success: true, passwordResetToken: token };
  }

  async resetPassword(params: { token: string; newPassword: string }) {
    const password = requirePassword(params.newPassword);
    const record = await this.prisma.token.findUnique({ where: { token: params.token } });
    if (!record || record.type !== 'PASSWORD_RESET') {
      throw new BadRequestException('invalid token');
    }
    if (record.usedAt) {
      throw new BadRequestException('token already used');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('token expired');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.token.update({
        where: { token: params.token },
        data: { usedAt: new Date() },
      }),
    ]);

    return { success: true };
  }

  private async signToken(userId: string, email: string, role: UserRole) {
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '7d') as StringValue;
    return await this.jwt.signAsync(
      { sub: userId, email, role },
      { expiresIn },
    );
  }
}
