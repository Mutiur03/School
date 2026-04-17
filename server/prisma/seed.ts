import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
async function main() {
  const schools = await prisma.school.findMany({
    select: { id: true },
    orderBy: { id: "asc" },
  });

  if (schools.length === 0) {
    console.warn("⚠️ No school found. Skipping tenant seed data.");
    return;
  }

  const defaultCategories = ["Event", "Campus", "Labs", "Achievement"];
  const data = schools.flatMap((school) =>
    defaultCategories.map((category) => ({
      category,
      school_id: school.id,
    })),
  );

  await prisma.categories.createMany({
    data,
    skipDuplicates: true,
  });
}

main()
  .then(() => {
    console.log("✅ Seeding completed.");
  })
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
