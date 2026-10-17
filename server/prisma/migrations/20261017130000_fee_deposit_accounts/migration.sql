-- A fee head can fix the cash/bank account its money is deposited into, and every collected
-- installment records the account it went to (a receipt may now span several accounts).

ALTER TABLE "fee_heads" ADD COLUMN "deposit_head_id" INTEGER;
ALTER TABLE "fee_receipt_items" ADD COLUMN "deposit_head_id" INTEGER;

-- Existing receipts went wholly into their single pay head.
UPDATE "fee_receipt_items" i
SET "deposit_head_id" = r."pay_head_id"
FROM "fee_receipts" r
WHERE r."id" = i."receipt_id";

ALTER TABLE "fee_receipt_items" ALTER COLUMN "deposit_head_id" SET NOT NULL;

ALTER TABLE "fee_receipts" DROP COLUMN "pay_head_id";

CREATE INDEX "fee_heads_deposit_head_id_idx" ON "fee_heads"("deposit_head_id");
CREATE INDEX "fee_receipt_items_deposit_head_id_idx" ON "fee_receipt_items"("deposit_head_id");

ALTER TABLE "fee_heads" ADD CONSTRAINT "fee_heads_deposit_head_id_fkey"
  FOREIGN KEY ("deposit_head_id") REFERENCES "acc_heads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_receipt_items" ADD CONSTRAINT "fee_receipt_items_deposit_head_id_fkey"
  FOREIGN KEY ("deposit_head_id") REFERENCES "acc_heads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
