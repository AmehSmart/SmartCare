CREATE TABLE "admin_invitations" (
  "id" UUID NOT NULL,
  "code_hash" TEXT NOT NULL,
  "created_by_id" UUID NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "used_by_id" UUID,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_invitations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_invitations_code_hash_key" ON "admin_invitations"("code_hash");
CREATE INDEX "admin_invitations_expires_at_idx" ON "admin_invitations"("expires_at");
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_used_by_id_fkey" FOREIGN KEY ("used_by_id") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
