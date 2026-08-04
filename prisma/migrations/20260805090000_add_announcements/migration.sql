-- Business Announcements: broadcast messages from a superadmin to
-- all users, one branch, one department (free-text, matches
-- Employee.department), or one specific user. Delivery/read-tracking
-- reuses the existing Notification table (fan-out on create), so no
-- separate receipt table is needed here.
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'BRANCH', 'DEPARTMENT', 'USER');

CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audienceType" "AnnouncementAudience" NOT NULL DEFAULT 'ALL',
    "audienceBranchId" TEXT,
    "audienceDepartment" TEXT,
    "audienceUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Announcement_audienceType_createdAt_idx" ON "Announcement"("audienceType", "createdAt");

CREATE INDEX "Announcement_createdById_idx" ON "Announcement"("createdById");

ALTER TABLE "Announcement"
ADD CONSTRAINT "Announcement_audienceBranchId_fkey"
FOREIGN KEY ("audienceBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Announcement"
ADD CONSTRAINT "Announcement_audienceUserId_fkey"
FOREIGN KEY ("audienceUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Announcement"
ADD CONSTRAINT "Announcement_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
