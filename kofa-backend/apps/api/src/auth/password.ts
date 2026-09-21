import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password: string): string {
    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, 64);
    return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
    const [algorithm, saltValue, hashValue] = stored.split('$');
    if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
    const expected = Buffer.from(hashValue, 'base64');
    const actual = scryptSync(password, Buffer.from(saltValue, 'base64'), expected.length);
    return timingSafeEqual(actual, expected);
}
