# Memory — Neon Hackathon Authentication

Last updated: 2026-09-18 22:25 +01:00

## What was built

- Replaced Keycloak authentication with `POST /v1/auth/login`, Neon-backed user password hashes, and locally signed eight-hour JWTs.
- Added `password_hash` to the clinical Prisma schema and its deployment migration.
- Replaced Redis-backed rate limiting with the Fastify plugin's in-memory limiter.
- Removed Keycloak configuration, realm fixture, Redis dependency, Docker setup, and container CI steps.
- Updated the beginner README, Neon environment template, architecture notes, and detailed API reference.

## Decisions made

- The hackathon deployment is two services (API and audit service) backed by two separate Neon projects.
- Authentication uses scrypt password hashes in Neon and HS256 JWTs. This is intentionally a hackathon design; managed identity and MFA are required before production.
- Rate limiting is process-local, so the hackathon API should run as a single instance.

## Problems solved

- Eliminated the operational burden of Docker, local PostgreSQL, Redis, and Keycloak.
- Kept the existing role, duty context, patient scope, break-glass, passport, offline, and audit behavior intact behind the new authentication guard.
- Prisma generation, ESLint, TypeScript checks, and all 21 unit tests pass after the change.

## Current state

- Code is ready to configure against two Neon projects.
- Demo users receive seeded password hashes; sensitive credential values are intentionally omitted here.
- The backend has not yet been exercised against the user's live Neon databases because their connection details are not present in the workspace.

## Next session starts with

1. Copy `.env.example` to `.env` and add the four Neon URLs plus newly generated application secrets.
2. Run `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev:audit`, and `pnpm dev:api`.
3. Call `POST /v1/auth/login`, select a duty context, and perform one patient read to verify the live end-to-end flow.

## Open questions

- Where the API and audit service will be hosted for the hackathon.
- Whether the frontend needs registration/password-reset flows or only seeded demo login.
