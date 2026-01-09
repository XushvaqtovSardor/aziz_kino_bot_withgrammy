-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPremiumBanned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "premiumBanCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "premiumBannedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_isPremiumBanned_idx" ON "User"("isPremiumBanned");
