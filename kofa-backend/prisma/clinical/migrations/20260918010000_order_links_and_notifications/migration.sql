CREATE TABLE "order_links" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "patient_id" UUID NOT NULL,
  "assignee_user_id" UUID NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "resource_types" TEXT[],
  "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_links_valid_window" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "order_links_nonempty_types" CHECK (cardinality("resource_types") > 0)
);

CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "recipient_id" UUID NOT NULL,
  "patient_id" UUID,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMP(3),
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_links_assignee_user_id_starts_at_ends_at_idx" ON "order_links"("assignee_user_id", "starts_at", "ends_at");
CREATE INDEX "order_links_patient_id_starts_at_ends_at_idx" ON "order_links"("patient_id", "starts_at", "ends_at");
CREATE INDEX "notifications_recipient_id_read_at_created_at_idx" ON "notifications"("recipient_id", "read_at", "created_at");

ALTER TABLE "order_links" ADD CONSTRAINT "order_links_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_links" ADD CONSTRAINT "order_links_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_links" ADD CONSTRAINT "order_links_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
