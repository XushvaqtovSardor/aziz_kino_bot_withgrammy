-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "totalEpisodes" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "MovieEpisode" (
    "id" SERIAL NOT NULL,
    "movieId" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "videoFileId" TEXT NOT NULL,
    "videoMessageId" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovieEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovieEpisode_movieId_idx" ON "MovieEpisode"("movieId");

-- CreateIndex
CREATE UNIQUE INDEX "MovieEpisode_movieId_episodeNumber_key" ON "MovieEpisode"("movieId", "episodeNumber");

-- AddForeignKey
ALTER TABLE "MovieEpisode" ADD CONSTRAINT "MovieEpisode_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
