CREATE TABLE IF NOT EXISTS "GalleryPhoto" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'NCC',
  "altText" TEXT NOT NULL,
  "image" BYTEA NOT NULL,
  "mimeType" TEXT NOT NULL,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GalleryPhoto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GalleryPhoto_isPublished_createdAt_idx" ON "GalleryPhoto"("isPublished", "createdAt");
CREATE TABLE IF NOT EXISTS "RankHolder" (
  "id" TEXT NOT NULL,
  "rank" TEXT NOT NULL,
  "name" TEXT,
  "image" BYTEA,
  "mimeType" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RankHolder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RankHolder_rank_key" ON "RankHolder"("rank");
CREATE TABLE IF NOT EXISTS "InstitutionalInfo" (
  "id" TEXT NOT NULL DEFAULT 'main',
  "address" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "timings" TEXT,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstitutionalInfo_pkey" PRIMARY KEY ("id")
);
