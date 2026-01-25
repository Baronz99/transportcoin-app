-- CreateTable
CREATE TABLE "WithdrawalAuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "withdrawalRequestId" INTEGER,
    "amountTcnSnapshot" INTEGER NOT NULL,
    "requiredTcg" INTEGER NOT NULL,
    "currentTcg" INTEGER NOT NULL,
    "deficitTcg" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WithdrawalAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WithdrawalAuditLog_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "WithdrawalRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
