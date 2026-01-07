-- AlterTable
ALTER TABLE "MandatoryChannel" ADD COLUMN     "currentMembers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "memberLimit" INTEGER,
ADD COLUMN     "pendingRequests" INTEGER NOT NULL DEFAULT 0;
