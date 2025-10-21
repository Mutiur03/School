-- CreateTable
CREATE TABLE "head_msg" (
    "id" SERIAL NOT NULL,
    "head_id" INTEGER NOT NULL,
    "head_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "head_msg_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "head_msg" ADD CONSTRAINT "head_msg_head_id_fkey" FOREIGN KEY ("head_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
