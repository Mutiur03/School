// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.admin.createMany({
    data: [{ username: "Mutiur", password: "1234" }],
    skipDuplicates: true,
  });

  await prisma.categories.createMany({
    data: [
      { category: "Event" },
      { category: "Campus" },
      { category: "Labs" }
    ],
    skipDuplicates: true,
  });
}


main()
  .then(() => {
    console.log("Seeding completed");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
