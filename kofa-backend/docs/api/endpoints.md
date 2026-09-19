# Kofa API reference

Base URL: `http://localhost:3000`. Requests and responses use JSON.

## Common rules

Except for login, health, metrics, and the passport public key, send:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
```

Clinical mutations also require `x-idempotency-key`, using a unique value of at least 16 characters. UUID values below are examples.

Validation errors use this shape:

```json
{
  "statusCode": 400,
  "code": "HTTP_400",
  "message": "Request validation failed",
  "issues": [],
  "path": "/v1/patients",
  "timestamp": "2026-09-18T12:00:00.000Z",
  "requestId": "req-1"
}
```

Authentication errors return `401`, permission errors `403`, and missing records `404`.

## Authentication

### `POST /v1/auth/login`

```json
{ "email": "aisha@example.test", "password": "your-password" }
```

Response:

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": 28800,
  "user": { "id": "<uuid>", "email": "aisha@example.test", "displayName": "Dr Aisha Bello" }
}
```

Use `accessToken` as the bearer token on subsequent requests.

## Health

- `GET /health/live` → `{ "status": "ok" }`
- `GET /health/ready` → `{ "status": "ready" }`
- `GET /metrics` → Prometheus text metrics without clinical data.

## Session

### `GET /v1/session/assignments`

Returns current staff assignments:

```json
[
  {
    "id": "50000000-0000-4000-8000-000000000001",
    "role": "DOCTOR",
    "wardId": "41000000-0000-4000-8000-000000000003",
    "startsAt": "2026-09-18T08:00:00.000Z",
    "endsAt": "2026-09-18T20:00:00.000Z"
  }
]
```

### `POST /v1/session/context`

Selects the assignment used for authorization.

```json
{ "assignmentId": "50000000-0000-4000-8000-000000000001" }
```

Response: selected context with assignment, role, facility, ward, and expiry.

## Patients

### `GET /v1/patients?query=amina&limit=25`

Returns only patients visible to the current user.

```json
{
  "items": [
    {
      "id": "30000000-0000-4000-8000-000000000001",
      "fhirId": "patient-amina-musa",
      "displayName": "Amina Musa",
      "birthDate": "2001-04-12T00:00:00.000Z",
      "currentWard": {
        "id": "41000000-0000-4000-8000-000000000002",
        "name": "Medical Ward B",
        "code": "WARD-B"
      }
    }
  ]
}
```

### `GET /v1/patients/:id`

Returns permitted patient data and FHIR resources.

```json
{
  "patient": {
    "id": "30000000-0000-4000-8000-000000000001",
    "fhirId": "patient-amina-musa",
    "displayName": "Amina Musa"
  },
  "resources": [
    {
      "resourceType": "Observation",
      "id": "amina-genotype",
      "status": "final",
      "_kofa": { "source": "HOSPITAL_VERIFIED", "updatedAt": "2026-09-01T09:00:00.000Z" }
    }
  ],
  "policy": { "fields": ["demographics", "conditions", "medications", "labs"] }
}
```

Out-of-scope reads return `403` with code `OUTSIDE_AUTHORIZED_SCOPE`.

### `POST /v1/patients/:id/resources`

Requires `x-idempotency-key`. The FHIR patient reference must match the URL patient.

```json
{
  "resource": {
    "resourceType": "Observation",
    "id": "haemoglobin-2026-09-18",
    "status": "final",
    "subject": { "reference": "Patient/patient-amina-musa" },
    "code": {
      "coding": [{ "system": "http://loinc.org", "code": "718-7", "display": "Haemoglobin" }]
    },
    "valueQuantity": { "value": 8.4, "unit": "g/dL" }
  }
}
```

Response `201`: stored row containing `patientId`, `resourceType`, `fhirId`, `version`, `sourceLabel`, and timestamps.

### `POST /v1/patients/:id/sensitive-reveal`

Doctor/nurse only; requires `x-idempotency-key`.

```json
{ "reason": "Required for the current treatment decision" }
```

Response: `{ "resources": [<permitted sensitive FHIR resources>] }`.

### `POST /v1/patients/:id/order-links`

Attached doctor grants temporary lab/pharmacy access; requires `x-idempotency-key`.

```json
{
  "assigneeUserId": "20000000-0000-4000-8000-000000000007",
  "resourceTypes": ["Observation", "DiagnosticReport"],
  "endsAt": "2026-09-19T12:00:00.000Z"
}
```

Response `201`: order link with IDs, permitted resource types, and validity window.

### `GET /v1/patients/:id/access-log`

Patient/caregiver only.

```json
{
  "items": [
    {
      "occurredAt": "2026-09-18T12:00:00.000Z",
      "actor": "Dr Aisha Bello",
      "actorRole": "DOCTOR",
      "action": "READ_CHART",
      "decision": "GRANT",
      "purposeOfUse": "TREATMENT"
    }
  ]
}
```

## Emergency access

### `POST /v1/patients/:id/breakglass`

Doctor/nurse only. The idempotency key is in the payload.

```json
{
  "totp": "123456",
  "reasonCode": "UNCONSCIOUS_PATIENT",
  "reasonText": "Patient arrived without identification",
  "idempotencyKey": "breakglass-unique-0001"
}
```

Response `201`:

```json
{
  "emergencySessionId": "70000000-0000-4000-8000-000000000001",
  "summary": {
    "patient": { "id": "30000000-0000-4000-8000-000000000001", "displayName": "Amina Musa" },
    "allergiesReactions": [],
    "currentMedications": [],
    "transfusionHistory": [],
    "keyComplications": [],
    "homeFacility": {
      "value": "ABUTH",
      "source": "HOSPITAL_VERIFIED",
      "updatedAt": "2026-09-18T12:00:00.000Z"
    },
    "issuedAt": "2026-09-18T12:00:00.000Z",
    "expiresAt": "2026-09-18T12:10:00.000Z"
  },
  "banner": {
    "reasonCode": "UNCONSCIOUS_PATIENT",
    "expiresAt": "2026-09-18T12:10:00.000Z",
    "auditReceipt": { "id": "...", "sequence": "42", "recordedAt": "...", "hash": "..." }
  }
}
```

### `DELETE /v1/emergency-sessions/:id`

Ends the caller's session. Response: `{ "ended": true }`.

## Passport and consent

- `GET /v1/passport/keys/current` is public and returns `{ "keyId": "dev-2026-01", "algorithm": "Ed25519", "publicKey": "<base64url>" }`.
- `POST /v1/passport/grants` payload: `{ "patientId": "<uuid>", "pin": "123456", "expiresInSeconds": 3600 }`. Response: `{ "grantId": "...", "token": "<encrypted-token>", "expiresAt": "...", "key": { "keyId": "...", "algorithm": "Ed25519", "publicKey": "..." } }`.
- `GET /v1/passport/grants?patientId=:id` → `{ "items": [{ "id": "...", "scope": "emergency-summary", "status": "ACTIVE", "expiresAt": "...", "revokedAt": null }] }`.
- `POST /v1/passport/use` requires `x-idempotency-key`; payload `{ "token": "<encrypted-token>", "pin": "123456" }`; response `{ "summary": {}, "verification": { "signatureValid": true, "onlineStatus": "ACTIVE", "auditReceipt": {} } }`.
- `DELETE /v1/passport/grants/:id` → `{ "revoked": true }`.

## Notifications

- `GET /v1/notifications` → `{ "items": [{ "id": "...", "type": "BREAK_GLASS_ACCESS", "title": "Emergency access used", "metadata": {}, "createdAt": "...", "readAt": null }] }`.
- `PATCH /v1/notifications/:id/read` → `{ "read": true }`.

## Offline devices

### `POST /v1/offline/devices`

```json
{ "name": "Ward tablet 3", "signingPublicKey": "<base64url>", "encryptionPublicKey": "<base64url>" }
```

Response `201`: registered device with status `PENDING`.

### `POST /v1/offline/devices/:id/cache`

Payload: `{ "patientIds": ["30000000-0000-4000-8000-000000000001"] }`. Response: encrypted cache manifest and ciphertext.

### `POST /v1/offline/sync`

```json
{
  "deviceId": "80000000-0000-4000-8000-000000000001",
  "events": [
    {
      "idempotencyKey": "offline-event-000001",
      "sequence": "1",
      "occurredAt": "2026-09-18T12:00:00.000Z",
      "manifestId": "90000000-0000-4000-8000-000000000001",
      "patientRef": "30000000-0000-4000-8000-000000000001",
      "action": "READ_CACHED_CHART",
      "signature": "<base64url>"
    }
  ]
}
```

Response: `{ "accepted": 1, "lastSequence": "1" }`.

## Administration

Admin only:

- `GET /v1/admin/roster` returns users, assignments, wards, and devices without clinical data.
- `POST /v1/admin/assignments` payload: `{ "userId": "<uuid>", "role": "NURSE", "wardId": "<uuid>", "startsAt": "2026-09-18T08:00:00Z", "endsAt": "2026-09-18T20:00:00Z" }`.
- `DELETE /v1/admin/assignments/:id` → `{ "disabled": true }`.
- `POST /v1/admin/users/:id/totp-enrollment` returns an enrollment secret and `otpauth` URI.
- `POST /v1/admin/totp-enrollment/confirm` payload `{ "code": "123456" }` → `{ "enrolled": true }`.
- `PATCH /v1/admin/devices/:id` payload `{ "status": "ACTIVE" }` or `{ "status": "REVOKED" }`; response is the updated device.

## Audit

Audit officer only:

- `GET /v1/audit/events?limit=50&cursor=100` → `{ "items": [<events>], "nextCursor": "50" }`.
- `GET /v1/audit/flags` → open abuse flags.
- `PATCH /v1/audit/flags/:id` payload `{ "status": "ESCALATED", "disposition": "Sent for investigation" }` → updated flag.
- `POST /v1/audit/verify` → `{ "valid": true, "checkedCount": 42, "checkpoint": {}, "checkpointPublicKey": "<base64url>" }`.
- `GET /v1/audit/checkpoints/latest` → `{ "checkpoint": { "sequence": "42", "hash": "...", "eventCount": "42", "signature": "..." }, "algorithm": "Ed25519", "publicKey": "..." }`.

Swagger UI is available at `/docs`; its JSON document is `/docs/openapi.json`.
