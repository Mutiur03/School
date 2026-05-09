-- CreateTable
CREATE TABLE "ssc_reg" (
    "id" SERIAL NOT NULL,
    "a_sec_roll" TEXT,
    "b_sec_roll" TEXT,
    "notice" TEXT,
    "ssc_year" INTEGER,

    CONSTRAINT "ssc_reg_pkey" PRIMARY KEY ("id")
);
