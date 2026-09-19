# Kofa backend

Kofa is a NestJS API for protected FHIR patient records, consent passports, emergency access, and tamper-evident auditing.

## Beginner setup

You need Node.js 22+, pnpm 11+, and two Neon databases. Docker, Redis, Keycloak, and local PostgreSQL are not required.

1. In Neon, create one project for clinical data and a second project for audit data. Keeping them separate protects the audit trail.
2. In each project's **Connect** dialog, copy both connection strings:
   - pooled connection (`-pooler` in the hostname) for the running service;
   - direct connection for migrations.
3. Copy `.env.example` to `.env`. Put the clinical URLs in `CLINICAL_DATABASE_URL` and `CLINICAL_MIGRATION_DATABASE_URL`; put the audit URLs in `AUDIT_DATABASE_URL` and `AUDIT_MIGRATION_DATABASE_URL`.
4. Set `AUTH_JWT_SECRET` to a long random value of at least 32 characters.

Install packages and prepare both Neon databases:

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
```

Then open two terminals:

```bash
pnpm dev:audit
```

```bash
pnpm dev:api
```

The API runs at `http://localhost:3000`; Swagger is at `http://localhost:3000/docs`. The audit service runs at `http://localhost:3001` and is called internally by the API.

Run `pnpm db:seed` to create the demo accounts. Their development password is `KofaDemo!2026`; sign in using an email from `scripts/seed/index.ts`. Doctor and nurse TOTP uses `JBSWY3DPEHPK3PXP`. Never reuse these values with real data.

## Useful commands

```bash
pnpm dev:api          # start the main API
pnpm dev:audit        # start the audit service
pnpm db:migrate       # apply database migrations
pnpm db:seed          # load demo records
pnpm check            # format, lint, typecheck, and test
pnpm build            # production TypeScript build
```

For routes, permissions, payloads, and responses, read [docs/api/endpoints.md](./docs/api/endpoints.md).

The advanced architecture, threat model, and production checklist remain in `docs/` for later deployment work; beginners do not need them to understand or edit the API.
