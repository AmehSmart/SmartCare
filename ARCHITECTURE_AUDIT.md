# SmartCare architecture audit

**Scope inspected:** frontend source and services; backend packages, controllers, services, schemas, migrations, seeds, environment example, and architecture/API documentation. No live database credentials or `.env` values were read, so the database findings below are verified from the Prisma schemas and committed migrations rather than a running database.

## 1. Architecture discovered

### Frontend

- React 19 + Vite 8 JavaScript single-page application, using React Router 7 and component-local CSS.
- Authentication state is held in `AuthContext`; bearer tokens and the profile are persisted in `sessionStorage`.
- `services/api/config.js` selects either the real backend when `VITE_API_BASE_URL` is set, or an in-memory mock implementation otherwise.
- Routes have client-side `ProtectedRoute` and `PermissionRoute` guards. The permission table comes from frontend `mockData`, not the API.
- Main pages cover dashboard, patient worklist/record, staff & roles, audit, emergency flows, profile, notifications, and passport/offline flows.
- The sidebar is permission-filtered and has a mobile overlay/collapsed mode. Responsive CSS exists, but the important page flows have not yet been browser-tested at the requested breakpoints.

### Backend

- pnpm workspace TypeScript monorepo: NestJS/Fastify API (`apps/api`), separate NestJS audit service (`apps/audit-service`), Prisma schemas, contracts, policy core, and browser passport package.
- PostgreSQL is used through two distinct Prisma clients/databases: clinical and audit.
- The API has a global JWT guard; public routes use an explicit decorator. Controllers delegate to services; access decisions are centralized in `packages/core/src/policy.ts` through `PolicyService`.
- The audit service receives authenticated internal calls and persists hash-chained, idempotent audit events with abuse flags and verification checkpoints.

## 2. Database structure discovered

| Concept requested | Actual model / relationship | Status |
| --- | --- | --- |
| User | `UserProfile`; optional `facilityId`, optional patient identity, password hash | EXISTING |
| Staff | No separate Staff model; a staff member is `UserProfile` + time-bounded `Assignment` | EXISTING (different shape) |
| Role | `Role` enum on `Assignment` | EXISTING |
| Permission | No database permission table or role-permission join; permissions are static policy code | MISSING as a data model |
| Department | No department model or FK | MISSING |
| Ward | `Ward` belongs to `Facility`; patient has optional `currentWardId`; assignment has optional `wardId` | EXISTING |
| Shift | No shift model; `Assignment.startsAt` / `endsAt` provide time-windowed duty scope | EXISTING (time window, not named shifts) |
| Patient | `Patient` has FHIR ID, facility, current ward, name, birth date, and `active` boolean; clinical content is versioned `FhirResource` JSON | EXISTING |
| Patient assignment | `CaseAttachment` joins user to patient with a time window; this is doctor/case scope, not a generic staff assignment | EXISTING (limited) |
| Emergency access | `EmergencySession` joins user to patient with reason, audit-event reference and expiry | EXISTING |
| Audit log | Separate audit DB: `AuditEvent`, `AbuseFlag`, `ChainCheckpoint`, `VerificationRun`, `ChainState` | EXISTING |

Foreign keys and safe deletion behavior are present in the migrations. Facilities cascade to wards; patient deletion is restricted through facility relationships and cascades FHIR resources/case attachments/order links; emergency sessions and consent grants restrict deletion of their user/patient principals. Assignment and emergency/consent/cache time windows have database check constraints.

## 3. Authentication and authorization

### Authentication flow

1. `POST /v1/auth/login` verifies scrypt password hashes for an active `UserProfile` and issues an 8-hour HS256 JWT with subject and JTI.
2. The global guard validates signature, issuer, audience, expiry, algorithm and JTI.
3. The client retrieves active assignments and selects one using `POST /v1/session/context`.
4. `ContextService` binds that JTI to a `DutyContext`; every protected operation resolves the user and selected active assignment from the server-side database.

### RBAC and contextual rules

- Roles are enum values: `PATIENT`, `CAREGIVER`, `DOCTOR`, `NURSE`, `RECORDS_CLERK`, `LOCUM_DOCTOR`, `LAB_PHARMACY`, `AUDIT_OFFICER`, `ADMIN`.
- Backend is authoritative. `decidePolicy` combines role, facility, active assignment, ward match, case attachment, lab/pharmacy order link, patient/caregiver relationship, and emergency authorization.
- Field projection is server-side: doctors receive broad clinical fields when case-attached; nurses require same ward and receive a narrower set; clerks get demographics/billing; lab/pharmacy requires an active order link; admin has roster/device administration and explicitly no clinical-read policy; audit officers read audit metadata only.
- Doctors require a current `CaseAttachment`; nurses are ward-scoped; assignment time windows constitute the current shift check. There is no department criterion and no individual permission override mechanism.

### Emergency access

- Only active doctors and nurses can break glass, with TOTP replay prevention, mandatory reason, pre-release audit append, patient-bound ten-minute sessions, and explicit session end.
- An active session can authorize an otherwise out-of-scope chart read and is audited as emergency access.
- Note: the current implementation grants the emergency chart projection including `sensitiveFlags` to both doctor and nurse. This conflicts with the frontend README claim that break-glass does not elevate a nurse to doctor-level sensitive access and needs a product/security decision before change.

## 4. Current workflows and API contract

- Staff: login, choose duty context, use scoped patient search/read/write, sensitive reveal, break-glass, notifications, offline cache/device features, and passport functionality.
- Admin: active admin assignment is required for roster, assignment creation/disablement, TOTP enrollment initiation, and device status changes. API admin workflow does not include patient management, patient-to-staff case attachment management, permission management, or dashboard metrics.
- Audit officer: reads and verifies audit chain / manages abuse flags via audit endpoints.
- Clinical API returns visible patients only; direct chart reads make and audit a policy decision. Protected client routing is complementary only; it cannot grant API access.

## 5. Seed/mock data inspected

- Backend seed is idempotent via deterministic IDs and Prisma upserts. It uses synthetic hospital, wards, seven users, three active patients, assignments, one doctor case attachment, one lab order link, synthetic FHIR resources, and development password hashing.
- Seed roles currently include doctor, nurse, records clerk, audit officer, admin, lab/pharmacy, and a patient user. It has no second/third doctor or nurse, no pharmacist-specific role, no department/shift model, and no seeded emergency sessions/audit events.
- Its current data is dated through 2035 for active assignments, so it remains active in the current development period.
- The password is development-only but is printed in source in the seed script; it is not production runtime code. This should be moved to an explicit development environment variable or documented fixture before expanding the seed data.
- Frontend `mockData.js` is a separate mutable fake dataset for patients, roles, permissions, assignments, audit records, and roles. It is not synchronized with the backend seed/API.

## 6. Important weaknesses found

1. **Split authorization/data architecture — NEEDS CHANGE.** If no API URL is configured, the frontend authorizes and mutates against mock role and patient data. This can give a misleading security demo and conflicts with the backend model. Production/demo configuration should require the API for protected clinical/admin workflows, or clearly isolate mock mode.
2. **Client permission model diverges from backend — NEEDS CHANGE.** `roleService.js` contains mutable roles/permissions and routes rely on them. Backend roles are static policy code and do not support these per-permission CRUD operations. The UI must derive display/route capabilities from an API-backed current context without treating them as authority.
3. **Admin roster contract mismatch — NEEDS CHANGE.** `AdminService.roster()` returns an array of users, while `backendAdapter.getAdminRoster()` expects `{ users, assignments, wards }`; roster integration will yield an empty directory in backend mode.
4. **Admin patient workflow is absent — MISSING.** The backend policy deliberately prevents admin clinical read and exposes no all-patient administrative listing, patient assignment/case-attachment management, patient status filtering, or metrics endpoint. This must be designed so hospital administration can manage non-clinical patient metadata and assignments without bypassing clinical field policy.
5. **Patient status is insufficient — NEEDS CHANGE.** The schema only has `active: Boolean`; it cannot faithfully represent `ACTIVE`, `DISCHARGED`, and other explicit statuses or admission/discharge dates requested by the brief. The frontend currently labels every backend patient `Active`.
6. **Department and named shift concepts are absent — MISSING.** Do not create parallel frontend-only fields. If required by the product, add normalized backend models/migrations or keep the existing assignment time windows as the defined shift mechanism.
7. **Generic patient-staff assignments are limited — NEEDS CHANGE.** `CaseAttachment` is sufficient for doctor case scope but the API has no admin management endpoint and nursing is ward-scoped, not patient-assignment-scoped. The requested “assign/reassign staff” workflow needs a clear mapping to existing case attachments (and possibly a new generic relationship only if policy requirements demand it).
8. **Dashboard metrics are not real in backend mode — NEEDS CHANGE.** Current dashboard fetches scoped patients and calculates only partial counts; it omits assignment counts in API mode and relies on local mock assignments in mock mode. There is no backend aggregation endpoint for admin metrics.
9. **Frontend real-API shaping loses data — NEEDS CHANGE.** It hardcodes patient status and shift, falls back role labels, and assumes shapes that several API endpoints do not return. It must not manufacture security-relevant presentation data.
10. **Audit feature is structurally strong — ALREADY WORKING.** Separate audit database, append-only hash chain, idempotency, verification, and abuse flags are implemented. Seeded audit scenarios and UI/API contract testing are still needed.
11. **Backend authorization is generally sound — ALREADY WORKING.** JWT validation, server-side duty context, policy decision point, field projection, and audited allow/deny reads address the primary frontend-role manipulation and IDOR concerns for existing endpoints.
12. **Endpoint documentation is partially stale — NEEDS CHANGE.** It documents the roster response as an object that the server does not return, and it omits the implemented patient transfer endpoint.

## 7. Recommended controlled implementation order

1. Resolve the data model decisions: explicit patient lifecycle status, whether departments/named shifts are required, and whether generic staff-patient assignment is needed beyond case attachments.
2. Add backward-compatible migrations only for approved missing concepts; do not drop or replace existing tables.
3. Add server-authorized admin APIs for roster, patient administration/assignment management, and database-backed metrics; audit every mutation.
4. Expand the idempotent development seed around the actual schema and roles, using only synthetic data.
5. Replace the frontend’s protected mock-mode workflow with real API integrations, correct contract adapters, real loading/empty/error states, and route display guards that mirror—never replace—backend authorization.
6. Retouch the admin/staff dashboards, patients, details, assignment UI, and navigation after API contracts are stable; then run browser responsive tests from 320px through 1440px.
7. Run defined lint/build/typecheck/test/migration commands and targeted authorization integration tests.

## 8. Current implementation baseline

No code, schema, migration, seed, or environment file has been changed during this inspection. The next phase can proceed with controlled, incremental changes against the architecture above.
