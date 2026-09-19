# Operations runbook

## Migrations

Apply clinical migrations with the clinical owner credential and audit migrations with the audit owner credential:

```bash
pnpm db:migrate
```

The audit runtime credential must not own its database. After migration, verify that it cannot update or delete `audit_events`.

## Key rotation

1. Generate keys with a cryptographically secure source or KMS/HSM.
2. Add the new passport key identifier and retain previous public keys through the longest passport lifetime.
3. Switch signing to the new key.
4. Retire the prior private key only after every token it signed is expired.
5. Rotate field and TOTP envelope keys with a re-encryption job; do not simply replace the environment value.
6. Record rotations in the security audit trail.

The demonstration reads one signing seed from configuration. Production should replace this adapter with KMS signing and store key metadata in `facility_signing_keys`.

## Audit verification

Run verification from an authenticated audit-officer session using `POST /v1/audit/verify`. A valid response states the number of entries checked. On failure:

1. restrict administrative access to both systems;
2. preserve database snapshots and service logs;
3. verify the latest checkpoint's Ed25519 signature with the public key returned by `/v1/audit/checkpoints/latest`, then compare the first broken sequence with the most recent externally stored checkpoint;
4. rotate application and database credentials;
5. investigate the actor and infrastructure events around that sequence;
6. do not repair or delete evidence in place.

## Backup and restore

- Back up clinical and audit databases independently with encrypted, point-in-time recovery.
- Copy signed audit checkpoints to immutable storage in a separate account.
- Test restore at least quarterly and after schema changes.
- Restore audit data into an isolated database first and run the verifier before declaring recovery successful.

## Dependency failure

| Dependency              | Behavior                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Clinical PostgreSQL     | Readiness fails; record operations stop                                               |
| Audit service/database  | Protected reads and mutations fail closed with 503                                    |
| Authentication database | Login fails; existing JWTs remain valid until their short expiry                      |
| Passport status check   | Online use fails; a standalone offline verifier may rely only on signature and expiry |

## Incident signals

Alert on audit append failures, chain verification failure, repeated TOTP failure, repeated break-glass, clerk patient bursts, device sequence gaps, readiness failure, unusual 401/403 rates, and signing-key lookup failures. Metrics and logs must contain opaque IDs only—never names, conditions, medications, reasons, PINs, TOTP secrets, tokens, or record bodies.
