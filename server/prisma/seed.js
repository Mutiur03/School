import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const url = new URL(process.env.DATABASE_URL);
for (const key of [
  'connection_limit',
  'pool_timeout',
  'connect_timeout',
  'socket_timeout',
  'pgbouncer',
  'schema',
]) {
  url.searchParams.delete(key);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: url.toString(),
    connectionTimeoutMillis: 5000,
  }),
});

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_super_admin', '1', true)`;

    const schools = await tx.school.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    if (schools.length === 0) {
      console.warn('⚠️ No school found. Skipping tenant seed data.');
      return;
    }

    const defaultCategories = ['Event', 'Campus', 'Labs', 'Achievement'];
    await tx.categories.createMany({
      data: schools.flatMap((school) =>
        defaultCategories.map((category) => ({
          category,
          school_id: school.id,
        })),
      ),
      skipDuplicates: true,
    });
  });
}

main()
  .then(() => {
    console.log('✅ Seeding completed.');
  })
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
