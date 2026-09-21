import { describe, expect, it } from 'vitest';
import {
    hashInvitationCode,
    isAdminInvitationValid,
    normalizeAdminEmail,
} from './auth.service.js';

describe('auth service helpers', () => {
    it('normalizes the admin email before registration', () => {
        expect(normalizeAdminEmail('  ADMIN@Example.com  ')).toBe('admin@example.com');
    });

    it('normalizes invitation code hashing consistently', () => {
        const code = 'SMARTCARE-ADMIN-INVITE-1234';
        expect(hashInvitationCode(code)).toBe(hashInvitationCode('  smartcare-admin-invite-1234  '));
    });

    it('rejects expired, used, or revoked invitation codes', () => {
        const now = new Date();
        expect(
            isAdminInvitationValid({
                expiresAt: new Date(now.getTime() + 60_000),
                usedAt: null,
                revokedAt: null,
            }),
        ).toBe(true);
        expect(
            isAdminInvitationValid({
                expiresAt: new Date(now.getTime() + 60_000),
                usedAt: new Date(),
                revokedAt: null,
            }),
        ).toBe(false);
        expect(
            isAdminInvitationValid({
                expiresAt: new Date(now.getTime() + 60_000),
                usedAt: null,
                revokedAt: new Date(),
            }),
        ).toBe(false);
        expect(
            isAdminInvitationValid({
                expiresAt: new Date(now.getTime() - 60_000),
                usedAt: null,
                revokedAt: null,
            }),
        ).toBe(false);
    });
});
