-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hasTelegramPremium" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "User_hasTelegramPremium_idx" ON "User"("hasTelegramPremium");
