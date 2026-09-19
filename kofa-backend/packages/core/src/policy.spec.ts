import { describe, expect, it } from 'vitest';
import { decidePolicy, type PolicyInput } from './policy.js';

const base: PolicyInput = {
  role: 'NURSE',
  action: 'READ_CHART',
  sameFacility: true,
  assignmentActive: true,
  sameWard: true,
  attachedToCase: false,
  orderLinked: false,
  isSelf: false,
  isDependent: false,
  emergencyAuthorized: false,
};

describe('policy decision point', () => {
  it('allows a nurse on the active patient ward without sensitive flags', () => {
    const decision = decidePolicy(base);
    expect(decision.allowed).toBe(true);
    expect(decision.fields).not.toContain('sensitiveFlags');
  });

  it('denies a nurse crossing wards', () => {
    expect(decidePolicy({ ...base, sameWard: false })).toMatchObject({
      allowed: false,
      reason: 'OUTSIDE_SCOPE',
      fields: [],
    });
  });

  it('never grants an admin clinical read', () => {
    expect(decidePolicy({ ...base, role: 'ADMIN' }).allowed).toBe(false);
  });

  it('caps emergency access at the emergency projection', () => {
    expect(
      decidePolicy({
        ...base,
        role: 'DOCTOR',
        action: 'READ_EMERGENCY_SUMMARY',
        emergencyAuthorized: true,
      }),
    ).toMatchObject({ allowed: true, fields: ['emergencySummary'] });
  });

  it('does not let a patient write their own hospital record', () => {
    expect(
      decidePolicy({ ...base, role: 'PATIENT', action: 'WRITE_CLINICAL', isSelf: true }),
    ).toMatchObject({ allowed: false, reason: 'ROLE_FORBIDDEN' });
  });

  it('allows lab/pharmacy access only through an active order link', () => {
    expect(decidePolicy({ ...base, role: 'LAB_PHARMACY', orderLinked: true }).allowed).toBe(true);
    expect(decidePolicy({ ...base, role: 'LAB_PHARMACY', orderLinked: false }).allowed).toBe(false);
  });

  it.each([
    ['DOCTOR', true, false, true],
    ['DOCTOR', false, false, false],
    ['NURSE', false, true, true],
    ['NURSE', false, false, false],
    ['RECORDS_CLERK', false, false, true],
    ['LOCUM_DOCTOR', false, true, true],
    ['LAB_PHARMACY', false, false, false],
    ['AUDIT_OFFICER', false, false, false],
    ['ADMIN', false, false, false],
  ] as const)('applies normal read scope for %s', (role, attachedToCase, sameWard, allowed) => {
    expect(decidePolicy({ ...base, role, attachedToCase, sameWard }).allowed).toBe(allowed);
  });
});
