-- CreateEnum
CREATE TYPE "PermissionResource" AS ENUM ('INVESTMENTS', 'ASSETS', 'TRANSACTIONS', 'DISTRIBUTIONS', 'FILINGS');

-- CreateEnum
CREATE TYPE "PermissionLevel" AS ENUM ('READ', 'WRITE', 'FULL');

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "resource" "PermissionResource" NOT NULL,
    "level" "PermissionLevel" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_permissions_user_id_idx" ON "user_permissions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_user_id_resource_key" ON "user_permissions"("user_id", "resource");

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
