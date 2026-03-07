CREATE TABLE "DashboardAlert" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'HIGH',
    "requiresAction" BOOLEAN NOT NULL DEFAULT true,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "viewedAt" DATETIME,
    "actedAt" DATETIME,
    "resolvedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdByAdminId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DashboardAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "DashboardAlert_userId_status_createdAt_idx" ON "DashboardAlert"("userId", "status", "createdAt");
