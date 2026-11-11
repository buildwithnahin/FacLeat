-- Persisted "active branch/company" selection (switcher dropdown), read by
-- both the cookie-based web session (getSession) and the Bearer-token mobile
-- session (getMobileSession) via buildSessionForUser. Falls back to
-- defaultBranchId/defaultCompanyId when unset.
ALTER TABLE "User" ADD COLUMN "activeBranchId" TEXT;
ALTER TABLE "User" ADD COLUMN "activeCompanyId" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_activeBranchId_fkey" FOREIGN KEY ("activeBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_activeCompanyId_fkey" FOREIGN KEY ("activeCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
