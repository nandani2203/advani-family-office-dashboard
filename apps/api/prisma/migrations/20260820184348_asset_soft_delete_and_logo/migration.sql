-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "logo_url" TEXT;

-- CreateIndex
CREATE INDEX "assets_archived_at_idx" ON "assets"("archived_at");
