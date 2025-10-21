-- CreateTable
CREATE TABLE "class_slot_time" (
    "id" SERIAL NOT NULL,
    "start_time" VARCHAR(8) NOT NULL,
    "end_time" VARCHAR(8) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_slot_time_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_routine" (
    "id" SERIAL NOT NULL,
    "class" INTEGER NOT NULL,
    "slot_id" INTEGER NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "subject" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_routine_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "class_routine" ADD CONSTRAINT "class_routine_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "class_slot_time"("id") ON DELETE CASCADE ON UPDATE CASCADE;
