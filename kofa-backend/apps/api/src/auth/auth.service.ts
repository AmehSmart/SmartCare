import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SignJWT } from 'jose';
import { loadApiConfig } from '../config.js';
import { ClinicalDatabase } from '../database.service.js';

@Injectable()
export class AuthService {
  private readonly secret = new TextEncoder().encode(loadApiConfig().AUTH_JWT_SECRET);

  constructor(private readonly database: ClinicalDatabase) {}

  async login(email: string, password: string): Promise<unknown> {
    const user = await this.database.userProfile.findUnique({ where: { email } });
    if (!user?.active || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    const expiresIn = 8 * 60 * 60;
    const accessToken = await new SignJWT({ email: user.email, name: user.displayName })
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

function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, saltValue, hashValue] = stored.split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, 'base64');
  const actual = scryptSync(password, Buffer.from(saltValue, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}
