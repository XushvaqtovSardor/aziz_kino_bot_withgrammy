-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('PUBLIC', 'PRIVATE', 'EXTERNAL');

-- DropIndex
DROP INDEX "MandatoryChannel_channelId_key";

-- AlterTable
ALTER TABLE "Broadcast" ADD COLUMN     "fromChatId" TEXT,
ADD COLUMN     "fromMessageId" INTEGER;

-- AlterTable
ALTER TABLE "MandatoryChannel" ADD COLUMN     "type" "ChannelType" NOT NULL DEFAULT 'PUBLIC',
ALTER COLUMN "channelId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "MandatoryChannel_type_idx" ON "MandatoryChannel"("type");
