-- Refresh tokens for the Super-Admin-only mobile app. The raw token is
-- never stored — only its SHA-256 hash — so a leaked DB row can't be used
-- to authenticate.
CREATE TABLE "MobileRefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileRefreshToken_tokenHash_key" ON "MobileRefreshToken"("tokenHash");

CREATE INDEX "MobileRefreshToken_userId_idx" ON "MobileRefreshToken"("userId");

ALTER TABLE "MobileRefreshToken"
ADD CONSTRAINT "MobileRefreshToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
