import * as Sentry from "@sentry/node";

const sentryDsn = process.env.SENTRY_DSN;

type SentryAuthUser = {
  role: string;
  id: number | string | bigint;
  email?: string | null;
  username?: string | null;
  name?: string | null;
};

export function initSentry() {
  if (!sentryDsn) {
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV ?? "development",
    enabled: process.env.NODE_ENV === "production",
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      Sentry.prismaIntegration(),
    ],
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1,
    initialScope: {
      tags: { app: "server" },
    },
  });
}

export function syncSentryUser(user: SentryAuthUser | null | undefined) {
  if (!sentryDsn) {
    return;
  }

  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setTag("role", user.role);
  Sentry.setUser({
    id: String(user.id),
    ...(user.email ? { email: user.email } : {}),
    ...(user.username
      ? { username: user.username }
      : user.name
        ? { username: user.name }
        : {}),
  });
}

export function captureServerException(error: unknown) {
  if (!sentryDsn) {
    return;
  }

  Sentry.captureException(error);
}

export function recordSlowQueryBreadcrumb(event: {
  query: string;
  params: string;
  duration: number;
}) {
  if (!sentryDsn) {
    return;
  }

  Sentry.addBreadcrumb({
    category: "db.query",
    message: event.query,
    level: "warning",
    data: {
      duration_ms: event.duration,
      params: event.params,
    },
  });
}

export function recordDatabasePoolMetrics(stats: {
  total: number;
  active: number;
  idle: number;
  maxConnections: number;
  prismaPool: number | null;
}) {
  if (!sentryDsn || process.env.NODE_ENV !== "production") {
    return;
  }

  Sentry.metrics.gauge("db.connections.total", stats.total);
  Sentry.metrics.gauge("db.connections.active", stats.active);
  Sentry.metrics.gauge("db.connections.idle", stats.idle);
  Sentry.metrics.gauge("db.connections.postgres_max", stats.maxConnections);

  if (stats.prismaPool !== null) {
    Sentry.metrics.gauge("db.connections.prisma_pool_limit", stats.prismaPool);
  }
}

export { Sentry };
