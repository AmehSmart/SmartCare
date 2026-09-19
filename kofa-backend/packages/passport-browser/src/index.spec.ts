import { randomBytes, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createPassport, keyPairFromSeed, verifyPassport, type PassportClaims } from './index.js';

it('round-trips through the Web API implementation', () => {
  const now = new Date('2026-09-18T10:00:00.000Z');
  const keys = keyPairFromSeed(randomBytes(32));
  const claims: PassportClaims = {
    tokenId: randomUUID(),
    grantId: randomUUID(),
    issuer: 'ABUTH',
    audience: 'kofa-emergency-summary',
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60_000).toISOString(),
    summary: {
      patient: { id: randomUUID(), displayName: 'Amina Musa' },
      allergiesReactions: [],
      currentMedications: [],
      transfusionHistory: [],
      keyComplications: [],
      homeFacility: {
        value: 'ABUTH',
        source: 'HOSPITAL_VERIFIED',
        updatedAt: now.toISOString(),
      },
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 60_000).toISOString(),
    },
  };
  const token = createPassport({
    claims,
    pin: '123456',
    keyId: 'key-1',
    signingSecretKey: keys.secretKey,
  });
  expect(
    verifyPassport({ token, pin: '123456', publicKey: keys.publicKey, now }).claims.tokenId,
  ).toBe(claims.tokenId);
}, 20_000);
