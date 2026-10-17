-- Opening balances live in one journal voucher per school, flagged so it can be found and locked.
ALTER TABLE "acc_vouchers" ADD COLUMN "is_opening" BOOLEAN NOT NULL DEFAULT false;
