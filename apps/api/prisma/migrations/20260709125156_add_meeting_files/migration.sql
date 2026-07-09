-- CreateEnum
CREATE TYPE "MeetingFileKind" AS ENUM ('RECORDING', 'ATTACHMENT');

-- CreateEnum
CREATE TYPE "MeetingFileStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'ERROR');

-- CreateTable
CREATE TABLE "meeting_files" (
    "id" TEXT NOT NULL,
    "kind" "MeetingFileKind" NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "status" "MeetingFileStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "meetingId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_files_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "meeting_files" ADD CONSTRAINT "meeting_files_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_files" ADD CONSTRAINT "meeting_files_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
