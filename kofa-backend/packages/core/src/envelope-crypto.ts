import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export type EncryptedEnvelope = {
  version: 1;
  iv: string;
  ciphertext: string;
  tag: string;
};

export function encryptEnvelope(plaintext: string, key: Uint8Array, aad: string): string {
  assertKey(key);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.from(
    JSON.stringify({
      version: 1,
      iv: iv.toString('base64url'),
      ciphertext: ciphertext.toString('base64url'),
      tag: cipher.getAuthTag().toString('base64url'),
    } satisfies EncryptedEnvelope),
  ).toString('base64url');
}

export function decryptEnvelope(serialized: string, key: Uint8Array, aad: string): string {
  assertKey(key);
  const parsed = JSON.parse(
    Buffer.from(serialized, 'base64url').toString('utf8'),
  ) as EncryptedEnvelope;
  if (parsed.version !== 1) throw new Error('Unsupported encrypted envelope version');
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(parsed.iv, 'base64url'));
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(parsed.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function assertKey(key: Uint8Array): void {
  if (key.byteLength !== 32) throw new TypeError('Encryption key must be exactly 32 bytes');
}
