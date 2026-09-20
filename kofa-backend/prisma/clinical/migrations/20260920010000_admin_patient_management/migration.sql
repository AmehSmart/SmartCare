CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'DISCHARGED', 'INACTIVE');

CREATE TABLE "departments" (
  "id" UUID NOT NULL,
  "facility_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shifts" (
  "id" UUID NOT NULL,
  "facility_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "starts_at" TEXT NOT NULL,
  "ends_at" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "wards" ADD COLUMN "department_id" UUID;
ALTER TABLE "patients" ADD COLUMN "department_id" UUID;
ALTER TABLE "patients" ADD COLUMN "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "patients" ADD COLUMN "admitted_at" TIMESTAMP(3);
ALTER TABLE "patients" ADD COLUMN "discharged_at" TIMESTAMP(3);
ALTER TABLE "assignments" ADD COLUMN "department_id" UUID;
ALTER TABLE "assignments" ADD COLUMN "shift_id" UUID;

-- Preserve the existing boolean semantics for deployments that already have data.
UPDATE "patients" SET "status" = 'INACTIVE' WHERE "active" = false;

CREATE UNIQUE INDEX "departments_facility_id_code_key" ON "departments"("facility_id", "code");
CREATE UNIQUE INDEX "shifts_facility_id_code_key" ON "shifts"("facility_id", "code");
CREATE INDEX "patients_facility_id_status_idx" ON "patients"("facility_id", "status");
CREATE INDEX "assignments_department_id_starts_at_ends_at_idx" ON "assignments"("department_id", "starts_at", "ends_at");
CREATE INDEX "assignments_shift_id_starts_at_ends_at_idx" ON "assignments"("shift_id", "starts_at", "ends_at");

ALTER TABLE "departments" ADD CONSTRAINT "departments_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wards" ADD CONSTRAINT "wards_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "patients" ADD CONSTRAINT "patients_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
