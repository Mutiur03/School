import * as Sentry from "@sentry/react";
import {
  createRoutesFromChildren,
  matchRoutes,
  Routes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import { useEffect } from "react";
import envPreferredRole from "./role";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

export const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes);

type SentryAuthUser =
  | { role: "admin"; id: string; username: string; email: string }
  | { role: "teacher"; id: number; name: string; email: string }
  | { role: "student"; id: number; name: string; email?: string }
  | { role: "super_admin"; id: number; email: string };

export function syncSentryUser(user: SentryAuthUser | null) {
  if (!sentryDsn) {
    return;
  }

  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setTag("role", user.role);

  switch (user.role) {
    case "admin":
      Sentry.setUser({ id: user.id, username: user.username, email: user.email });
      break;
    case "teacher":
      Sentry.setUser({ id: String(user.id), username: user.name, email: user.email });
      break;
    case "student":
      Sentry.setUser({
        id: String(user.id),
        username: user.name,
        ...(user.email ? { email: user.email } : {}),
      });
      break;
    case "super_admin":
      Sentry.setUser({ id: String(user.id), email: user.email });
      break;
  }
}

export function initSentry() {
  if (!sentryDsn) {
    if (import.meta.env.PROD) {
      console.error("[Sentry] VITE_SENTRY_DSN missing in production build");
    }
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,
    integrations: [
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    initialScope: {
      tags: {
        app: "dashboard",
        ...(envPreferredRole ? { role: envPreferredRole } : {}),
      },
    },
  });
}

export { Sentry };
