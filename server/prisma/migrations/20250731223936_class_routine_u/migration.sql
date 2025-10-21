/*
  Warnings:

  - A unique constraint covering the columns `[class,slot_id,day]` on the table `class_routine` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "class_routine_class_slot_id_day_key" ON "class_routine"("class", "slot_id", "day");
