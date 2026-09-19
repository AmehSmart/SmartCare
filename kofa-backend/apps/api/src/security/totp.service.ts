import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { decryptEnvelope, encryptEnvelope } from '@kofa/core';
import { ClinicalDatabase } from '../database.service.js';
import { loadApiConfig } from '../config.js';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;

@Injectable()
export class TotpService {
  private readonly key = Buffer.from(loadApiConfig().TOTP_ENCRYPTION_KEY, 'base64');

  constructor(private readonly database: ClinicalDatabase) {}

  async beginEnrollment(userId: string, issuer = 'Kofa'): Promise<{ secret: string; uri: string }> {
    const secret = encodeBase32(randomBytes(20));
    const encryptedSecret = encryptEnvelope(secret, this.key, `totp:${userId}`);
    await this.database.totpCredential.upsert({
      where: { userId },
      create: { userId, encryptedSecret },
      update: { encryptedSecret, enabledAt: null, lastUsedStep: null, rotatedAt: new Date() },
    });
    const user = await this.database.userProfile.findUniqueOrThrow({ where: { id: userId } });
    return {
      secret,
      uri: `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(user.displayName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`,
    };
  }

  async confirmEnrollment(userId: string, code: string): Promise<void> {
    const credential = await this.database.totpCredential.findUnique({ where: { userId } });
    if (!credential) throw new BadRequestException('TOTP enrolment has not started');
    const step = currentStep();
    const secret = decryptEnvelope(credential.encryptedSecret, this.key, `totp:${userId}`);
    if (!validAtStep(secret, code, step)) throw new UnauthorizedException('TOTP code is invalid');
    await this.database.totpCredential.update({
      where: { userId },
      data: { enabledAt: new Date(), lastUsedStep: BigInt(step) },
    });
  }

  async verify(userId: string, code: string): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        Array<{ encrypted_secret: string; enabled_at: Date | null; last_used_step: bigint | null }>
      >`
        SELECT encrypted_secret, enabled_at, last_used_step
        FROM totp_credentials WHERE user_id = ${userId}::uuid FOR UPDATE
      `;
      const credential = rows[0];
      if (!credential?.enabled_at) throw new UnauthorizedException('TOTP is not enrolled');
      const secret = decryptEnvelope(credential.encrypted_secret, this.key, `totp:${userId}`);
      const nowStep = currentStep();
      const matchingStep = [nowStep - 1, nowStep, nowStep + 1].find((step) =>
        validAtStep(secret, code, step),
      );
      if (matchingStep === undefined) throw new UnauthorizedException('TOTP code is invalid');
      if (credential.last_used_step !== null && BigInt(matchingStep) <= credential.last_used_step) {
        throw new UnauthorizedException('TOTP code has already been used');
      }
      await transaction.totpCredential.update({
        where: { userId },
        data: { lastUsedStep: BigInt(matchingStep) },
      });
    });
  }
}

function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

function validAtStep(secret: string, code: string, step: number): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  const expected = Buffer.from(binary.toString().padStart(6, '0'));
  const actual = Buffer.from(code);
  return expected.byteLength === actual.byteLength && timingSafeEqual(expected, actual);
}

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(value: string): Buffer {
  let bits = 0;
  let current = 0;
  const output: number[] = [];
  for (const character of value.toUpperCase().replace(/=+$/, '')) {
    const index = BASE32.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 TOTP secret');
    current = (current << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((current >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}
