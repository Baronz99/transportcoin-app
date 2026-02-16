ALTER TABLE "WithdrawalRequest" ADD COLUMN "queuedAt" DATETIME;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "queueDueAt" DATETIME;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "queueLane" TEXT;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "expediteAppliedAt" DATETIME;
