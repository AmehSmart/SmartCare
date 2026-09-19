# Backend API Integration Guide

> **Live backend wired (Kofa).** The service layer now connects to the real Kofa
> NestJS API in `../kofa-backend`. Set `VITE_API_BASE_URL` (see `.env.example`,
> default `http://localhost:3000`) and the app calls the live `/v1/*` endpoints;
> leave it unset to keep using the mock data below.
>
> - Toggle + HTTP client: `src/services/api/config.js`, `src/services/api/httpClient.js`
> - Response mapping (Kofa `/v1/*` → the shapes these screens expect): `src/services/api/backendAdapter.js`
> - Wired flows: login (`/v1/auth/login` + `/v1/session/assignments` + `/v1/session/context`),
>   patient list & chart (`/v1/patients`), sensitive reveal (`/v1/patients/:id/sensitive-reveal`),
>   break-glass (`/v1/patients/:id/breakglass`), audit log/queue/verify (`/v1/audit/*`),
>   and a new Notifications screen (`/v1/notifications`).
> - Sign in with a seeded email (e.g. `aisha@example.test`) and the demo password
>   from `kofa-backend/README.md`. Doctor/nurse break-glass TOTP is `JBSWY3DPEHPK3PXP`.
>
> The sections below document the original mock contract and remain valid for
> offline/mock mode.

This frontend is implemented as a mock-driven prototype and is intended to connect to a backend service without changing the UI contract. All API usage is centralized under the `src/services/api` layer. The frontend should be able to switch from mock mode to real backend mode cleanly.

## Authentication

### Login

- Feature: Sign in as a hospital staff member.
- Endpoint: `POST /api/auth/login`
- HTTP method: `POST`
- Authentication requirement: None for the login request itself.
- Request body:

  ```json
  {
    "staffId": "DR001",
    "pin": "123456"
  }
  ```

- Query parameters: None.
- Path parameters: None.
- Expected response:

  ```json
  {
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token",
    "user": {
      "id": "DR001",
      "name": "Dr. Adaeze Okonkwo",
      "role": "Attending Doctor",
      "ward": "Internal Medicine",
      "shift": "Day Shift"
    }
  }
  ```

- Possible error responses:
  - `401 Unauthorized` — invalid credentials.
  - `403 Forbidden` — account disabled or suspended.
  - `409 Conflict` — concurrent sessions flagged.
- Frontend screen using it: Login page.
- Notes about authorization: Role, ward, and shift should be returned here and used for downstream access decisions.
- Status: MOCKED — backend implementation pending.

### Current Staff Context

- Feature: Retrieve the current authenticated staff access context.
- Endpoint: `GET /api/auth/me`
- HTTP method: `GET`
- Authentication requirement: Bearer token required.
- Request body: None.
- Query parameters: None.
- Path parameters: None.
- Expected response:

  ```json
  {
    "id": "N8002",
    "name": "Nurse Emeka Nwosu",
    "role": "Nurse",
    "ward": "Ward B",
    "shift": "Day Shift",
    "department": "Ward B",
    "accessLevel": "Ward-limited clinical access"
  }
  ```

- Frontend screen using it: Sidebar, dashboard, worklist, and patient chart.
- Notes about authorization: Represents the active access context that the backend has approved for the current session.
- Status: MOCKED — backend implementation pending.

## Patient Data

### Patient List

- Feature: List patients visible to the current staff member.
- Endpoint: `GET /api/patients`
- HTTP method: `GET`
- Authentication requirement: Token required.
- Request body: None.
- Query parameters:
  - `ward` (optional)
  - `shift` (optional)
  - `scope` (optional)
- Path parameters: None.
- Expected response:

  ```json
  [
    {
      "id": "PT-000184",
      "patientNumber": "PT-000184",
      "name": "Fatima Abdullahi",
      "age": 34,
      "gender": "Female",
      "ward": "Ward B",
      "status": "Active",
      "scope": "Out of scope",
      "access": {
        "allowed": false,
        "reason": "PATIENT_OUTSIDE_WARD_SCOPE"
      }
    }
  ]
  ```

- Frontend screen using it: Patient worklist.
- Notes about authorization: The backend decides whether each patient appears in-scope or denied.
- Status: MOCKED — backend implementation pending.

### Patient Details

- Feature: Retrieve patient record data with field-level visibility based on authorization policy.
- Endpoint: `GET /api/patients/:id`
- HTTP method: `GET`
- Authentication requirement: Token required.
- Request body: None.
- Query parameters: None.
- Path parameters:
  - `id` — patient ID.
- Expected response:

  ```json
  {
    "id": "PT-2024-0561",
    "patientNumber": "PT-2024-0561",
    "name": "Ngozi Nnadi",
    "age": 25,
    "gender": "Female",
    "ward": "Maternity",
    "access": {
      "allowed": true,
      "scope": "ward",
      "reason": null
    },
    "demographics": {
      "dob": "2001-07-08",
      "address": "5 Igbinedion Road, Lagos",
      "phone": "+234-803-555-0143"
    },
    "diagnosis": ["Routine postnatal monitoring"],
    "medications": [{ "name": "Folic acid", "dose": "5 mg", "schedule": "Once daily" }],
    "labs": [{ "label": "Hemoglobin", "value": "11.5 g/dL" }],
    "sensitiveFields": {
      "hivStatus": "redacted",
      "mentalHealth": "redacted",
      "genotype": "redacted"
    }
  }
  ```

- Frontend screen using it: Scoped chart and patient record tabs.
- Notes about authorization: The backend should not leak hidden fields; the frontend only renders based on server response.
- Status: MOCKED — backend implementation pending.

### Sensitive Field Reveal Request

- Feature: Allow a clinician to request temporary reveal of a sensitive field that is normally hidden.
- Endpoint: `POST /api/patients/:id/fields/reveal`
- HTTP method: `POST`
- Authentication requirement: Token required.
- Request body:

  ```json
  {
    "field": "hivStatus",
    "reason": "Clinical emergency requires HIV status for safe medication decision",
    "actorId": "N8002"
  }
  ```

- Query parameters: None.
- Path parameters:
  - `id` — patient ID.
- Expected response:

  ```json
  {
    "allowed": true,
    "field": "hivStatus",
    "patientId": "PT-000184",
    "actorId": "N8002",
    "reason": "Clinical emergency requires HIV status for safe medication decision",
    "revealedAt": "2026-09-12T19:36:00Z"
  }
  ```

- Possible error responses:
  - `403 Forbidden` — insufficient permission.
  - `422 Unprocessable Entity` — missing reason or invalid field.
  - `429 Too Many Requests` — repeated reveal attempts.
- Frontend screen using it: Sensitive field reveal interaction in chart and patient records.
- Notes about authorization: Reveal is auditable and backend-authorized. The frontend must not perform the security decision itself.
- Status: MOCKED — backend implementation pending.

## Emergency Access

### Emergency Access Request

- Feature: Start a break-glass request that requires TOTP verification and a reason.
- Endpoint: `POST /api/emergency-access/request`
- HTTP method: `POST`
- Authentication requirement: Valid authenticated staff session.
- Request body:

  ```json
  {
    "patientId": "PT-000184",
    "actorId": "N8002",
    "reason": "Unconscious patient",
    "ward": "Ward B",
    "shift": "Day Shift"
  }
  ```

- Query parameters: None.
- Path parameters: None.
- Expected response:

  ```json
  {
    "grantId": "grant-12345",
    "status": "pending_verification",
    "expiresAt": "2026-09-12T20:00:00Z"
  }
  ```

- Possible error responses:
  - `403 Forbidden` — role does not qualify for emergency access.
  - `422 Unprocessable Entity` — missing emergency reason.
  - `409 Conflict` — another emergency grant is active.
- Frontend screen using it: Break-glass flow.
- Notes about authorization: Reason is mandatory and should be logged with the access grant.
- Status: MOCKED — backend implementation pending.

### Emergency Access Verification

- Feature: Verify the TOTP code for a break-glass request.
- Endpoint: `POST /api/emergency-access/verify`
- HTTP method: `POST`
- Authentication requirement: Token required and grant-specific verification.
- Request body:

  ```json
  {
    "grantId": "grant-12345",
    "code": "123456"
  }
  ```

- Query parameters: None.
- Path parameters: None.
- Expected response:

  ```json
  {
    "allowed": true,
    "grantId": "grant-12345",
    "status": "active",
    "expiresAt": "2026-09-12T20:00:00Z"
  }
  ```

- Possible error responses:
  - `401 Unauthorized` — invalid TOTP.
  - `410 Gone` — expired grant.
  - `403 Forbidden` — verification rejected by backend policy.
- Frontend screen using it: Break-glass modal and emergency summary page.
- Notes about authorization: The frontend should treat this as an authoritative access decision from the backend.
- Status: MOCKED — backend implementation pending.

### Emergency Access Status

- Feature: Retrieve remaining emergency access time and status.
- Endpoint: `GET /api/emergency-access/:grantId/status`
- HTTP method: `GET`
- Authentication requirement: Token required.
- Query parameters: None.
- Path parameters:
  - `grantId` — break-glass grant ID.
- Expected response:

  ```json
  {
    "status": "active",
    "expiresAt": "2026-09-12T20:00:00Z"
  }
  ```

- Frontend screen using it: Emergency access countdown banner and expiry handling.
- Notes about authorization: The timer should reflect backend-issued expiry, not client-only calculations.
- Status: MOCKED — backend implementation pending.

## Audit and Compliance

### Audit Events

- Feature: Retrieve audit log entries.
- Endpoint: `GET /api/audit/events`
- HTTP method: `GET`
- Authentication requirement: Audit officer or admin token required.
- Request body: None.
- Query parameters:
  - `filter` (optional)
  - `page` (optional)
- Path parameters: None.
- Expected response:

  ```json
  [
    {
      "id": 1,
      "eventId": "EVT320",
      "actor": "Nurse Emeka Nwosu",
      "actorId": "N8002",
      "role": "NURSE",
      "action": "Field accessed",
      "field": "Allergies",
      "target": "Fatima Abdullahi",
      "timestamp": "2026-09-12T19:36:00Z",
      "hash": "7a1f32e14a91d4d47a7f32d47a7f32d4",
      "previousHash": "1233d4432033034c1233d4432b3f...",
      "integrityValid": true
    }
  ]
  ```

- Frontend screen using it: Audit log list and detail panel.
- Notes about authorization: Only auditable events that the user may access should be returned.
- Status: MOCKED — backend implementation pending.

### Audit Integrity Verification

- Feature: Verify the append-only audit chain.
- Endpoint: `POST /api/audit/verify`
- HTTP method: `POST`
- Authentication requirement: Audit officer or admin token required.
- Request body: None.
- Query parameters: None.
- Path parameters: None.
- Expected response:

  ```json
  {
    "integrityValid": true,
    "verifiedEvents": 20,
    "lastVerifiedAt": "2026-09-12T19:36:00Z",
    "checkpoint": "7a1f32e14a91d4d4..."
  }
  ```

- Frontend screen using it: Audit verification page.
- Notes about authorization: The frontend must show the backend result and not claim cryptographic assurance itself.
- Status: MOCKED — backend implementation pending.

### Audit Queue / Anomaly Review

- Feature: Return flagged anomalies for review.
- Endpoint: `GET /api/audit/queue`
- HTTP method: `GET`
- Authentication requirement: Audit officer or admin token required.
- Request body: None.
- Query parameters: None.
- Path parameters: None.
- Expected response:

  ```json
  [
    {
      "flag": "Ward mismatch",
      "actor": "Chioma Eze",
      "target": "Fatima Abdullahi",
      "time": "19:36",
      "severity": "High"
    }
  ]
  ```

- Frontend screen using it: Audit officer queue.
- Notes about authorization: Queue items are backend-detected, not UI-detected.
- Status: MOCKED — backend implementation pending.

## Staff and Role Configuration

### Role Permission Matrix

- Feature: Return the role-based field access matrix used by the policy engine.
- Endpoint: `GET /api/roles/permissions`
- HTTP method: `GET`
- Authentication requirement: Token required.
- Request body: None.
- Query parameters: None.
- Path parameters: None.
- Expected response:

  ```json
  [
    { "label": "Demographics", "doctor": true, "nurse": true, "records": true, "intern": true, "it": false }
  ]
  ```

- Frontend screen using it: Staff & roles matrix.
- Notes about authorization: The matrix provides policy visibility but does not replace server-side enforcement.
- Status: MOCKED — backend implementation pending.

## Backend Contract / Data Requirements

The backend should return authorization responses in a format that is safe to render on the client without UI-side business logic deciding patient visibility.

### Proposed contract for access decisions

```json
{
  "allowed": true,
  "scope": "ward",
  "reason": null
}
```

```json
{
  "allowed": false,
  "reason": "PATIENT_OUTSIDE_WARD_SCOPE"
}
```

```json
{
  "allowed": false,
  "reason": "OFF_SHIFT_ACCESS"
}
```

```json
{
  "allowed": false,
  "reason": "INSUFFICIENT_ROLE_PERMISSION"
}
```

The frontend expects the backend to provide a clear, consistent authorization response for each patient and each sensitive-field reveal request.

## Summary of Current Frontend Mocking

- Authentication: Mocked.
- Access context: Mocked.
- Patient list: Mocked.
- Patient chart and field visibility: Mocked.
- Break-glass request and verification: Mocked.
- Audit log and verification: Mocked.
- Staff permissions matrix: Mocked.
- Emergency expiry countdown: Mocked.

## Current Status

This frontend is a working prototype focused on UX, access-control workflow, and policy-driven display states. It is intentionally backend-agnostic and ready for a real service contract once the backend is implemented.
