# Threat model

## Protected assets

- Synthetic or real clinical record content
- Duty assignments, consent relationships, and caregiver links
- TOTP secrets and passport signing keys
- Audit evidence and integrity checkpoints
- Registered device identities and cached record envelopes

## Trust boundaries

The browser/device, public ingress, Kofa API, identity provider, clinical database, audit service, and audit database are distinct boundaries. The audit database is deliberately not reachable with the API's credentials.

## Principal threats and controls

| Threat                        | Primary controls                                                                                    | Residual risk                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| IDOR / cross-patient reads    | Patient lookup plus PDP on every request; server projections                                        | A live API compromise can bypass application code                                       |
| Stale ward access             | Live duty lookup keyed to OIDC session; short token/context expiry                                  | Incorrect roster data remains an operational risk                                       |
| Admin reads clinical data     | Admin role has no clinical projection                                                               | Database administrators remain privileged                                               |
| Break-glass abuse             | Active clinical role, TOTP replay protection, reason, short expiry, audit-first, high-severity flag | Colluding staff can state a plausible false reason                                      |
| Audit alteration              | Separate service/database, insert-only event permissions, hash chain, verifier                      | A database owner can still destroy the whole database; backups/checkpoints are required |
| Audit append race             | Serializable transaction plus locked chain head and idempotency key                                 | Database outage blocks protected access by design                                       |
| JWT confusion                 | Fixed issuer, audience and algorithms; remote JWKS; short expiry                                    | Identity-provider compromise defeats authentication                                     |
| Passport theft                | Mandatory PIN encryption, Argon2id, authenticated encryption, short expiry, revocation online       | Weak user PINs and offline revocation latency                                           |
| TOTP disclosure               | AES-GCM envelope, AAD bound to user, rate limiting, no logs                                         | Host/key compromise exposes all local secrets                                           |
| Offline cache theft           | Device public-key encryption, expiry, approved devices                                              | Client keystore quality is outside this backend                                         |
| Offline replay or fabrication | Ed25519 signature, monotonic sequence, manifest scope, idempotency                                  | A stolen unlocked device key can sign until revoked                                     |
| PHI in telemetry              | Structured error envelope and documented redaction paths                                            | Developers must preserve redaction when adding fields                                   |

## Failure policy

- Authorization uncertainty denies normal access.
- Audit-service failure denies protected reads and mutations.
- Emergency access never silently falls back; an explicit, authenticated break-glass path is always required.
- A failed clinical mutation after an audit authorization record is observable; consumers should treat the record as an attempted/authorized action, not proof of database success.

## Non-goals

This code does not claim to defeat an attacker controlling the operating system, database-owner credential, Keycloak signing keys, or facility signing seed. Production controls must add network segmentation, KMS/HSM custody, immutable backups, endpoint security, personnel controls, and independent monitoring.
