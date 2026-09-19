-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PATIENT', 'CAREGIVER', 'DOCTOR', 'NURSE', 'RECORDS_CLERK', 'LOCUM_DOCTOR', 'LAB_PHARMACY', 'AUDIT_OFFICER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SourceLabel" AS ENUM ('PATIENT_ENTERED', 'DOCUMENT_BACKED', 'HOSPITAL_VERIFIED');

-- CreateEnum
CREATE TYPE "GrantStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "oidc_subject" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "email" TEXT,
    "facility_id" UUID,
    "patient_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contact" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wards" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "fhir_id" TEXT NOT NULL,
    "facility_id" UUID NOT NULL,
    "current_ward_id" UUID,
    "display_name" TEXT NOT NULL,
    "birth_date" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fhir_resources" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "resource_type" TEXT NOT NULL,
    "fhir_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source_label" "SourceLabel" NOT NULL DEFAULT 'HOSPITAL_VERIFIED',
    "resource" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fhir_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "ward_id" UUID,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_attachments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),

    CONSTRAINT "case_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caregiver_links" (
    "id" UUID NOT NULL,
    "caregiver_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),

    CONSTRAINT "caregiver_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duty_contexts" (
    "id" UUID NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "selected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duty_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "totp_credentials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "encrypted_secret" TEXT NOT NULL,
    "enabled_at" TIMESTAMP(3),
    "last_used_step" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMP(3),

    CONSTRAINT "totp_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "reason_code" TEXT NOT NULL,
    "reason_text" TEXT,
    "audit_event_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "emergency_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_grants" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'emergency-summary',
    "status" "GrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "token_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_signing_keys" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "key_id" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "encrypted_private_key" TEXT NOT NULL,
    "active_from" TIMESTAMP(3) NOT NULL,
    "retired_at" TIMESTAMP(3),

    CONSTRAINT "facility_signing_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registered_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "signing_public_key" TEXT NOT NULL,
    "encryption_public_key" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'PENDING',
    "last_sequence" BIGINT NOT NULL DEFAULT 0,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "registered_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cache_manifests" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "encrypted_payload" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "scope_patient_ids" JSONB NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cache_manifests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_events" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "sequence" BIGINT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "audit_event_id" TEXT,

    CONSTRAINT "offline_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_oidc_subject_key" ON "user_profiles"("oidc_subject");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_email_key" ON "user_profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "facilities_code_key" ON "facilities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "wards_facility_id_code_key" ON "wards"("facility_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "patients_fhir_id_key" ON "patients"("fhir_id");

-- CreateIndex
CREATE INDEX "patients_facility_id_current_ward_id_idx" ON "patients"("facility_id", "current_ward_id");

-- CreateIndex
CREATE INDEX "patients_display_name_idx" ON "patients"("display_name");

-- CreateIndex
CREATE INDEX "fhir_resources_patient_id_resource_type_idx" ON "fhir_resources"("patient_id", "resource_type");

-- CreateIndex
CREATE UNIQUE INDEX "fhir_resources_resource_type_fhir_id_version_key" ON "fhir_resources"("resource_type", "fhir_id", "version");

-- CreateIndex
CREATE INDEX "assignments_user_id_starts_at_ends_at_idx" ON "assignments"("user_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "assignments_ward_id_starts_at_ends_at_idx" ON "assignments"("ward_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "case_attachments_patient_id_starts_at_ends_at_idx" ON "case_attachments"("patient_id", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "case_attachments_user_id_patient_id_starts_at_key" ON "case_attachments"("user_id", "patient_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "caregiver_links_caregiver_id_patient_id_key" ON "caregiver_links"("caregiver_id", "patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "duty_contexts_session_id_key" ON "duty_contexts"("session_id");

-- CreateIndex
CREATE INDEX "duty_contexts_user_id_expires_at_idx" ON "duty_contexts"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "totp_credentials_user_id_key" ON "totp_credentials"("user_id");

-- CreateIndex
CREATE INDEX "emergency_sessions_user_id_patient_id_expires_at_idx" ON "emergency_sessions"("user_id", "patient_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "consent_grants_token_id_key" ON "consent_grants"("token_id");

-- CreateIndex
CREATE INDEX "consent_grants_patient_id_status_expires_at_idx" ON "consent_grants"("patient_id", "status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "facility_signing_keys_key_id_key" ON "facility_signing_keys"("key_id");

-- CreateIndex
CREATE INDEX "facility_signing_keys_facility_id_active_from_idx" ON "facility_signing_keys"("facility_id", "active_from");

-- CreateIndex
CREATE INDEX "cache_manifests_device_id_expires_at_idx" ON "cache_manifests"("device_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "offline_events_idempotency_key_key" ON "offline_events"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "offline_events_device_id_sequence_key" ON "offline_events"("device_id", "sequence");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_current_ward_id_fkey" FOREIGN KEY ("current_ward_id") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fhir_resources" ADD CONSTRAINT "fhir_resources_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_attachments" ADD CONSTRAINT "case_attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_attachments" ADD CONSTRAINT "case_attachments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_links" ADD CONSTRAINT "caregiver_links_caregiver_id_fkey" FOREIGN KEY ("caregiver_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_links" ADD CONSTRAINT "caregiver_links_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_contexts" ADD CONSTRAINT "duty_contexts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_contexts" ADD CONSTRAINT "duty_contexts_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "totp_credentials" ADD CONSTRAINT "totp_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_sessions" ADD CONSTRAINT "emergency_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_sessions" ADD CONSTRAINT "emergency_sessions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_grants" ADD CONSTRAINT "consent_grants_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_grants" ADD CONSTRAINT "consent_grants_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_signing_keys" ADD CONSTRAINT "facility_signing_keys_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registered_devices" ADD CONSTRAINT "registered_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cache_manifests" ADD CONSTRAINT "cache_manifests_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_events" ADD CONSTRAINT "offline_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain invariants enforced below the application layer.
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_valid_window" CHECK ("ends_at" > "starts_at");
ALTER TABLE "duty_contexts" ADD CONSTRAINT "duty_contexts_valid_window" CHECK ("expires_at" > "selected_at");
ALTER TABLE "emergency_sessions" ADD CONSTRAINT "emergency_sessions_valid_window" CHECK ("expires_at" > "issued_at");
ALTER TABLE "consent_grants" ADD CONSTRAINT "consent_grants_valid_window" CHECK ("expires_at" > "created_at");
ALTER TABLE "cache_manifests" ADD CONSTRAINT "cache_manifests_valid_window" CHECK ("expires_at" > "issued_at");
ALTER TABLE "offline_events" ADD CONSTRAINT "offline_events_positive_sequence" CHECK ("sequence" > 0);
