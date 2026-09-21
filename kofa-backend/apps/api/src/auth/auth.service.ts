import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SignJWT } from 'jose';
import { loadApiConfig } from '../config.js';
import { ClinicalDatabase } from '../database.service.js';

@Injectable()
export class AuthService {
  private readonly secret = new TextEncoder().encode(loadApiConfig().AUTH_JWT_SECRET);

  constructor(@Inject(ClinicalDatabase) private readonly database: ClinicalDatabase) { }

  async login(email: string, password: string): Promise<unknown> {
    const user = await this.database.userProfile.findUnique({ where: { email } });
    if (!user?.active || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    return this.issueToken(user);
  }

  async registerStaff(
    email: string,
    staffId: string,
    displayName: string,
    pin: string,
  ): Promise<{ email: string; staffId: string; status: string }> {
    const normalizedEmail = normalizeAdminEmail(email);
    const normalizedStaffId = staffId.trim().toUpperCase();
    const normalizedDisplayName = displayName.trim();

    if (!normalizedEmail || !normalizedStaffId || !normalizedDisplayName) {
      throw new BadRequestException('Email, staff ID, and full name are required');
    }
    if (!/^\d{6}$/.test(pin)) {
      throw new BadRequestException('PIN must contain exactly 6 digits');
    }

    const existingUser = await this.database.userProfile.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    await this.database.userProfile.create({
      data: {
        authSubject: `staff:${normalizedStaffId}:${randomUUID()}`,
        displayName: normalizedDisplayName,
        email: normalizedEmail,
        passwordHash: hashPassword(pin),
        active: true,
      },
    });

    return { email: normalizedEmail, staffId: normalizedStaffId, status: 'pending_activation' };
  }

  async registerAdmin(email: string, password: string, invitationCode: string): Promise<unknown> {
    const normalizedEmail = normalizeAdminEmail(email);
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }
    if (!normalizedEmail || !invitationCode.trim()) {
      throw new BadRequestException('Email and administrator invitation code are required');
    }

    const invitationHash = hashInvitationCode(invitationCode);
    const createdAt = new Date();

    const result = await this.database.$transaction(async (transaction) => {
      const invitation = await transaction.adminInvitation.findFirst({
        where: {
          codeHash: invitationHash,
          revokedAt: null,
          usedAt: null,
          expiresAt: { gt: createdAt },
        },
      });

      if (!invitation) {
        throw new UnauthorizedException('Invalid or expired administrator invitation code');
      }

      const existingUser = await transaction.userProfile.findUnique({
        where: { email: normalizedEmail },
      });
      if (existingUser) {
        throw new ConflictException('An account with this email already exists');
      }

      const user = await transaction.userProfile.create({
        data: {
          authSubject: `admin:${randomUUID()}`,
          displayName: normalizedEmail.split('@')[0] || normalizedEmail,
          email: normalizedEmail,
          passwordHash: hashPassword(password),
          active: true,
        },
      });

      await transaction.assignment.create({
        data: {
          userId: user.id,
          role: 'ADMIN',
          startsAt: createdAt,
          endsAt: new Date(createdAt.getTime() + 10 * 365 * 24 * 60 * 60 * 1000),
          active: true,
        },
      });

      await transaction.adminInvitation.update({
        where: { id: invitation.id },
        data: { usedAt: createdAt, usedById: user.id },
      });

      return user;
    });

    return this.issueToken(result, 'ADMIN');
  }

  async createFirstAdminInvitation(): Promise<unknown> {
    const hasAdmin = await this.database.assignment.findFirst({
      where: {
        role: 'ADMIN',
        active: true,
        startsAt: { lte: new Date() },
        endsAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (hasAdmin) {
      throw new ConflictException('An administrator already exists');
    }

    const creator =
      (await this.database.userProfile.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })) ??
      (await this.database.userProfile.create({
        data: {
          authSubject: `bootstrap:${randomUUID()}`,
          displayName: 'Bootstrap admin invitation creator',
          email: null,
          active: true,
        },
        select: { id: true },
      }));

    return this.createInvitationRecord(creator.id, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  }

  private async createInvitationRecord(
    createdById: string,
    expiresAt: Date,
  ): Promise<{ id: string; code: string; expiresAt: Date; createdAt: Date }> {
    const code = generateAdminInvitationCode();
    const invitation = await this.database.adminInvitation.create({
      data: {
        codeHash: hashInvitationCode(code),
        createdById,
        expiresAt,
      },
    });
    return { id: invitation.id, code, expiresAt: invitation.expiresAt, createdAt: invitation.createdAt };
  }

  private async issueToken(
    user: { id: string; email: string | null; displayName: string; authSubject: string },
    role: 'ADMIN' | 'USER' = 'USER',
  ): Promise<unknown> {
    const expiresIn = 8 * 60 * 60;
    const accessToken = await new SignJWT({ email: user.email, name: user.displayName, role })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.authSubject)
      .setJti(randomUUID())
      .setIssuer('kofa-api')
      .setAudience('kofa-client')
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .sign(this.secret);
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    };
  }
}

export function generateAdminInvitationCode(): string {
  return `SMARTCARE-${randomBytes(10).toString('hex').toUpperCase()}`;
}

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashInvitationCode(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export function isAdminInvitationValid(invitation: {
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}): boolean {
  if (invitation.revokedAt || invitation.usedAt) return false;
  return invitation.expiresAt > new Date();
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, saltValue, hashValue] = stored.split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, 'base64');
  const actual = scryptSync(password, Buffer.from(saltValue, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}
