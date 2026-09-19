-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AuditDecision" AS ENUM ('GRANT', 'DENY', 'EMERGENCY', 'ERROR');

-- CreateEnum
CREATE TYPE "FlagStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "FlagSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "facility_id" TEXT,
    "patient_ref" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "decision" "AuditDecision" NOT NULL,
    "purpose_of_use" TEXT NOT NULL,
    "reason_code" TEXT,
    "reason_text" TEXT,
    "context" JSONB NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "previous_hash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abuse_flags" (
    "id" UUID NOT NULL,
    "audit_event_id" UUID NOT NULL,
    "rule_code" TEXT NOT NULL,
    "severity" "FlagSeverity" NOT NULL,
    "status" "FlagStatus" NOT NULL DEFAULT 'OPEN',
    "evidence" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "disposition" TEXT,

    CONSTRAINT "abuse_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chain_checkpoints" (
    "id" UUID NOT NULL,
    "sequence" BIGINT NOT NULL,
    "hash" TEXT NOT NULL,
    "event_count" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature" TEXT,

    CONSTRAINT "chain_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_runs" (
    "id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "valid" BOOLEAN,
    "checked_count" BIGINT NOT NULL DEFAULT 0,
    "first_broken_seq" BIGINT,
    "expected_hash" TEXT,
    "actual_hash" TEXT,
    "requested_by" TEXT NOT NULL,

    CONSTRAINT "verification_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chain_state" (
    "id" INTEGER NOT NULL,
    "last_sequence" BIGINT NOT NULL DEFAULT 0,
    "last_hash" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chain_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_sequence_key" ON "audit_events"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_idempotency_key_key" ON "audit_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "audit_events_actor_id_occurred_at_idx" ON "audit_events"("actor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_patient_ref_occurred_at_idx" ON "audit_events"("patient_ref", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_facility_id_occurred_at_idx" ON "audit_events"("facility_id", "occurred_at");

-- CreateIndex
CREATE INDEX "abuse_flags_status_severity_created_at_idx" ON "abuse_flags"("status", "severity", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "abuse_flags_audit_event_id_rule_code_key" ON "abuse_flags"("audit_event_id", "rule_code");

-- CreateIndex
CREATE UNIQUE INDEX "chain_checkpoints_sequence_key" ON "chain_checkpoints"("sequence");

-- AddForeignKey
ALTER TABLE "abuse_flags" ADD CONSTRAINT "abuse_flags_audit_event_id_fkey" FOREIGN KEY ("audit_event_id") REFERENCES "audit_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_positive_sequence" CHECK ("sequence" > 0);
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_hash_format" CHECK ("hash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_previous_hash_format" CHECK ("previous_hash" ~ '^[a-f0-9]{64}$');
