-- AlterTable
ALTER TABLE "WithdrawalAuditLog" ADD COLUMN "tierSnapshot" TEXT NOT NULL DEFAULT 'BASIC';
ALTER TABLE "WithdrawalAuditLog" ADD COLUMN "reserveFloorTcg" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WithdrawalAuditLog" ADD COLUMN "availableTcg" INTEGER NOT NULL DEFAULT 0;
