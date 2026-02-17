ALTER TABLE "WithdrawalRequest" ADD COLUMN "collateralTierSnapshot" TEXT NOT NULL DEFAULT 'BASIC';
ALTER TABLE "WithdrawalRequest" ADD COLUMN "collateralReserveFloorTcg" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "collateralRequiredTcg" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "holdDeficitTcg" INTEGER;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "holdReason" TEXT;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "proUpgradeActivatedAt" DATETIME;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "proUpgradeRevertDeadlineAt" DATETIME;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "lastPayoutRetryAt" DATETIME;
