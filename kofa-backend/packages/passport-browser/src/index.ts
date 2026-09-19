import { argon2id } from '@noble/hashes/argon2';
import {
  EmergencySummarySchema,
  PassportEnvelopeSchema,
  type EmergencySummary,
} from '@kofa/contracts';
import nacl from 'tweetnacl';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type PassportClaims = {
  tokenId: string;
  grantId: string;
  issuer: string;
  audience: 'kofa-emergency-summary';
  issuedAt: string;
  expiresAt: string;
  summary: EmergencySummary;
};

type SignedClaims = { claims: string; signature: string };

export function createPassport(input: {
  claims: PassportClaims;
  pin: string;
  keyId: string;
  signingSecretKey: Uint8Array;
}): string {
  if (input.pin.length < 6) throw new Error('Passport PIN must contain at least 6 characters');
  assertClaims(input.claims);
  if (input.signingSecretKey.byteLength !== nacl.sign.secretKeyLength) {
    throw new TypeError('Ed25519 signing secret key must be 64 bytes');
  }
  const claims = canonicalJson(input.claims);
  const signed: SignedClaims = {
    claims,
    signature: base64UrlEncode(nacl.sign.detached(encoder.encode(claims), input.signingSecretKey)),
  };
  const salt = secureRandom(16);
  const nonce = secureRandom(nacl.secretbox.nonceLength);
  const ciphertext = nacl.secretbox(
    encoder.encode(canonicalJson(signed)),
    nonce,
    derivePassportKey(input.pin, salt),
  );
  return base64UrlEncode(
    encoder.encode(
      canonicalJson({
        version: 1,
        keyId: input.keyId,
        salt: base64UrlEncode(salt),
        nonce: base64UrlEncode(nonce),
        ciphertext: base64UrlEncode(ciphertext),
      }),
    ),
  );
}

export function verifyPassport(input: {
  token: string;
  pin: string;
  publicKey: Uint8Array;
  now?: Date;
}): { claims: PassportClaims; keyId: string } {
  if (input.publicKey.byteLength !== nacl.sign.publicKeyLength) {
    throw new TypeError('Ed25519 public key must be 32 bytes');
  }
  const outer = PassportEnvelopeSchema.parse(
    JSON.parse(decoder.decode(base64UrlDecode(input.token))),
  );
  const salt = base64UrlDecode(outer.salt);
  const nonce = base64UrlDecode(outer.nonce);
  if (salt.byteLength !== 16 || nonce.byteLength !== nacl.secretbox.nonceLength) {
    throw new Error('Malformed passport cryptographic parameters');
  }
  const plaintext = nacl.secretbox.open(
    base64UrlDecode(outer.ciphertext),
    nonce,
    derivePassportKey(input.pin, salt),
  );
  if (!plaintext) throw new Error('Invalid PIN or damaged passport');
  const signed = JSON.parse(decoder.decode(plaintext)) as SignedClaims;
  if (
    !nacl.sign.detached.verify(
      encoder.encode(signed.claims),
      base64UrlDecode(signed.signature),
      input.publicKey,
    )
  ) {
    throw new Error('Passport signature is invalid');
  }
  const claims = JSON.parse(signed.claims) as PassportClaims;
  assertClaims(claims);
  const now = input.now ?? new Date();
  if (new Date(claims.expiresAt) <= now) throw new Error('Passport has expired');
  if (new Date(claims.issuedAt) > new Date(now.getTime() + 60_000)) {
    throw new Error('Passport issue time is in the future');
  }
  return { claims, keyId: outer.keyId };
}

export function keyPairFromSeed(seed: Uint8Array): nacl.SignKeyPair {
  if (seed.byteLength !== nacl.sign.seedLength)
    throw new TypeError('Ed25519 seed must be 32 bytes');
  return nacl.sign.keyPair.fromSeed(seed);
}

export function base64UrlEncode(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function derivePassportKey(pin: string, salt: Uint8Array): Uint8Array {
  return argon2id(encoder.encode(pin), salt, { t: 2, m: 19_456, p: 1, dkLen: 32 });
}

function secureRandom(length: number): Uint8Array {
  const value = new Uint8Array(length);
  globalThis.crypto.getRandomValues(value);
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new TypeError('Canonical JSON does not allow non-finite numbers');
    return value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    );
  }
  throw new TypeError(`Unsupported canonical JSON value: ${typeof value}`);
}

function assertClaims(claims: PassportClaims): void {
  if (claims.audience !== 'kofa-emergency-summary') throw new Error('Invalid passport audience');
  if (!claims.tokenId || !claims.grantId || !claims.issuer) {
    throw new Error('Missing passport identity fields');
  }
  if (
    !Number.isFinite(Date.parse(claims.issuedAt)) ||
    !Number.isFinite(Date.parse(claims.expiresAt))
  ) {
    throw new Error('Invalid passport timestamps');
  }
  EmergencySummarySchema.parse(claims.summary);
}
