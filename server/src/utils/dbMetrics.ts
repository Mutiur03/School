import { prisma } from "@/config/prisma.js";
import { recordDatabasePoolMetrics } from "@/config/sentry.js";

type ConnectionStateRow = {
  state: string | null;
  count: number;
};

function getPrismaConnectionLimit(): number | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  try {
    const limit = new URL(databaseUrl).searchParams.get("connection_limit");
    return limit ? Number(limit) : null;
  } catch {
    return null;
  }
}

export async function getDatabasePoolStats() {
  const [connections, byState, maxConnectionsRow] = await Promise.all([
    prisma.$queryRaw<Array<{ total: number }>>`
      SELECT count(*)::int AS total
      FROM pg_stat_activity
      WHERE datname = current_database()
    `,
    prisma.$queryRaw<ConnectionStateRow[]>`
      SELECT state, count(*)::int AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY state
    `,
    prisma.$queryRaw<Array<{ max_connections: string }>>`SHOW max_connections`,
  ]);

  const total = connections[0]?.total ?? 0;
  const stateCounts = Object.fromEntries(
    byState.map((row) => [row.state ?? "unknown", row.count]),
  );
  const active = stateCounts.active ?? 0;
  const idle = stateCounts.idle ?? 0;
  const maxConnections = Number(maxConnectionsRow[0]?.max_connections ?? 0);
  const prismaConnectionLimit = getPrismaConnectionLimit();

  const stats = {
    status: "ok" as const,
    connections: {
      total,
      active,
      idle,
      byState: stateCounts,
    },
    limits: {
      postgresMax: maxConnections,
      prismaPool: prismaConnectionLimit,
    },
  };

  recordDatabasePoolMetrics({
    total,
    active,
    idle,
    maxConnections,
    prismaPool: prismaConnectionLimit,
  });

  return stats;
}
