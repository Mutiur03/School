/**
 * In-memory session state + single-flight refresh. Mirrors the behaviour of the existing
 * dashboard (dashboard/src/context/unifiedAuthContext.tsx):
 * - access token in memory only;
 * - web (transport 'cookie'): the refresh token is an HttpOnly cookie JS never sees;
 * - native (transport 'body'): the refresh token lives only in SessionPersistence (SecureStore),
 *   is sent in the refresh body, and is replaced on every refresh (server-side rotation);
 * - concurrent 401s share one refresh request;
 * - only an explicit 401/403 from refresh ends the session. Network errors, 5xx, 429 and 402
 *   keep it, so a flaky connection or a cold server is never a logout.
 */
import type { AuthHooks } from './client';
import {
  isSessionPayload,
  type AuthUser,
  type SessionPayload,
  type TokenTransport,
  type UserRole,
} from './auth';
import { ApiError, isApiError } from './errors';
import type { SessionPersistence } from './token-store';
import { withTimeout } from '../timeout';

export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

export interface SessionSnapshot {
  status: SessionStatus;
  user: AuthUser | null;
  /** Why the last session ended, for UI messaging. */
  endedReason: 'signed-out' | 'expired' | null;
  /**
   * Set while `status` is `unknown` because the startup check could not reach the server (offline,
   * timeout) or could not read secure storage. The UI shows it with a Retry instead of spinning.
   */
  startupError: string | null;
  /**
   * Native only, while `status` is `unknown`: the role (and user id) saved with the stored refresh
   * token. UI routing hint so the role's screens can render while the refresh runs in the
   * background. NEVER an authorization decision: every request still needs the access token the
   * refresh returns, and the server re-checks the role on each call.
   */
  provisional: ProvisionalSession | null;
}

export interface ProvisionalSession {
  role: UserRole;
  userId: number | null;
}

export interface SessionManagerOptions {
  /** Performs the refresh call. Body transport passes the stored refresh token. */
  refreshRequest: (refreshToken?: string) => Promise<SessionPayload>;
  persistence: SessionPersistence;
  /** Default 'cookie' (web). */
  transport?: TokenTransport;
  /**
   * Backstop for the whole refresh call, in case `refreshRequest` itself never settles. The HTTP
   * client already aborts the request sooner (REFRESH_TIMEOUT_MS), so normally that fires first.
   */
  timeoutMs?: number;
  /** Startup wait before the offline fallback. Default STARTUP_REFRESH_TIMEOUT_MS. */
  startupTimeoutMs?: number;
}

const DEFAULT_SESSION_TIMEOUT_MS = 20_000;
/**
 * How long launch waits for the startup refresh before showing the app offline (with Retry). The
 * request itself keeps running (up to REFRESH_TIMEOUT_MS) and still applies if it lands later, so a
 * slow server never costs the rotated refresh token.
 */
export const STARTUP_REFRESH_TIMEOUT_MS = 7_000;
const SECURE_STORE_TIMEOUT_MS = 5_000;

type Listener = (snapshot: SessionSnapshot) => void;

export class SessionManager implements AuthHooks {
  private accessToken: string | null = null;
  private snapshot: SessionSnapshot = {
    status: 'unknown',
    user: null,
    endedReason: null,
    startupError: null,
    provisional: null,
  };
  private inflight: Promise<boolean> | null = null;
  private listeners = new Set<Listener>();

  constructor(private readonly options: SessionManagerOptions) {}

  getSnapshot = (): SessionSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getAccessToken(): string | null {
    return this.accessToken;
  }

  get transport(): TokenTransport {
    return this.options.transport ?? 'cookie';
  }

  /** Apply a login or refresh response (the refresh token, if any, is not kept in memory). */
  setSession(payload: SessionPayload) {
    this.accessToken = payload.accessToken;
    this.update({
      status: 'authenticated',
      user: payload.user,
      endedReason: null,
      startupError: null,
      provisional: null,
    });
  }

  /**
   * Apply a login response. Body transport persists the refresh token first, so a crash right
   * after login still leaves a usable session.
   */
  async signIn(payload: SessionPayload): Promise<void> {
    await this.persist(payload);
    this.setSession(payload);
  }

  /** Stored refresh token for logout (body transport); undefined on web. */
  async storedRefreshToken(): Promise<string | undefined> {
    if (this.transport !== 'body') return undefined;
    return (await this.options.persistence.load())?.refreshToken;
  }

  /** Single-flight refresh. See AuthHooks.refresh for the contract. */
  refresh(): Promise<boolean> {
    if (!this.inflight) {
      this.inflight = this.runRefresh().finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  /**
   * Resolves once requests can be sent: immediately with a token or once signed out; otherwise it
   * waits for the in-flight (or a new startup) refresh, so a query fired during launch goes out
   * once with the fresh token instead of 401 -> refresh -> retry. Never rejects.
   */
  awaitAccessToken(): Promise<void> {
    if (this.accessToken) return Promise.resolve();
    const pending =
      this.inflight ??
      (this.snapshot.status === 'unknown' && !this.snapshot.startupError ? this.refresh() : null);
    return pending ? pending.then(noop, noop) : Promise.resolve();
  }

  /**
   * Startup probe: try to restore a session from the refresh cookie / stored token. Transport
   * failures (or no answer within the startup timeout) leave the status `unknown` with a
   * `startupError`, so the UI can show "offline" instead of a login prompt. A late answer still
   * applies.
   */
  async bootstrap(): Promise<void> {
    // Retry after a failed start: back to a plain "checking" state.
    if (this.snapshot.status === 'unknown' && this.snapshot.startupError) {
      this.update({ ...this.snapshot, startupError: null });
    }
    const attempt = this.refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(
        () => resolve('timeout'),
        this.options.startupTimeoutMs ?? STARTUP_REFRESH_TIMEOUT_MS,
      );
    });
    try {
      const result = await Promise.race([attempt, timedOut]);
      if (result === 'timeout') {
        if (this.snapshot.status === 'unknown') {
          this.update({
            ...this.snapshot,
            startupError:
              'Restoring the session took too long. Check your connection and try again.',
          });
        }
        attempt.then(
          (ok) => this.afterStartup(ok),
          (error: unknown) => this.startupFailed(error),
        );
        return;
      }
      this.afterStartup(result);
    } catch (error) {
      this.startupFailed(error);
    } finally {
      clearTimeout(timer);
    }
  }

  private afterStartup(ok: boolean) {
    if (!ok && this.snapshot.status === 'unknown') {
      this.update({
        status: 'anonymous',
        user: null,
        endedReason: null,
        startupError: null,
        provisional: null,
      });
    }
  }

  private startupFailed(error: unknown) {
    if (this.snapshot.status !== 'unknown') return;
    if (isApiError(error) && error.isTransport) {
      // Keep the stored token (a flaky network is never a logout) but stop the spinner.
      this.update({
        ...this.snapshot,
        startupError:
          error.kind === 'timeout'
            ? `${error.message} Check your connection and try again.`
            : "Can't reach the server. Check your connection.",
      });
      return;
    }
    // 404/5xx/parse (e.g. no backend behind this origin): treat as signed out for now.
    this.update({
      status: 'anonymous',
      user: null,
      endedReason: null,
      startupError: null,
      provisional: null,
    });
  }

  onSessionExpired(_error: ApiError): void {
    void this.end('expired');
  }

  /**
   * Local sign-out. Call the logout endpoint first when online so the cookie is cleared too.
   * `keepStored` only drops the in-memory session (provider unmount / remount): the stored
   * native refresh token stays so the next bootstrap can restore it.
   */
  async end(reason: 'signed-out' | 'expired', opts?: { keepStored?: boolean }): Promise<void> {
    const previous = this.snapshot;
    this.accessToken = null;
    // Idempotent: a refresh 401 and the request that triggered it both report expiry.
    let endedReason: SessionSnapshot['endedReason'] = null;
    if (previous.status === 'authenticated' || reason === 'signed-out') endedReason = reason;
    else if (previous.status === 'anonymous') endedReason = previous.endedReason;
    // Update synchronously so concurrent requests stop sending the old token immediately.
    if (opts?.keepStored) {
      // Detached, not signed out: whoever bootstraps next decides.
      this.update({
        status: 'unknown',
        user: null,
        endedReason: null,
        startupError: null,
        provisional: null,
      });
      return;
    }
    this.update({
      status: 'anonymous',
      user: null,
      endedReason,
      startupError: null,
      provisional: null,
    });
    await this.options.persistence.clear();
  }

  private async persist(payload: SessionPayload) {
    if (this.transport !== 'body') return;
    if (!payload.refreshToken) {
      throw new ApiError({
        kind: 'parse',
        message: 'Native session response did not contain a refresh token.',
        path: 'session',
      });
    }
    await this.options.persistence.save({
      refreshToken: payload.refreshToken,
      role: payload.user.role,
      userId: payload.user.id,
      savedAt: Date.now(),
    });
  }

  private async runRefresh(): Promise<boolean> {
    try {
      let stored: string | undefined;
      if (this.transport === 'body') {
        const saved = await withTimeout(
          this.options.persistence.load(),
          SECURE_STORE_TIMEOUT_MS,
          'Reading the saved session',
        );
        stored = saved?.refreshToken;
        // Nothing stored: signed out, no request needed.
        if (!stored) {
          await this.end('expired');
          return false;
        }
        // Launch: let the UI route to the saved role while the refresh is in flight.
        if (this.snapshot.status === 'unknown' && !this.snapshot.provisional && saved?.role) {
          this.update({
            ...this.snapshot,
            provisional: { role: saved.role, userId: saved.userId ?? null },
          });
        }
      }
      const payload = await withTimeout(
        this.options.refreshRequest(stored),
        this.options.timeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS,
        'Restoring the session',
      );
      if (!isSessionPayload(payload)) {
        throw new ApiError({
          kind: 'parse',
          message: 'Refresh response did not contain a session.',
          path: 'refresh',
        });
      }
      // The old token is spent server-side: store the rotated one before anything else.
      await this.persist(payload);
      this.setSession(payload);
      return true;
    } catch (error) {
      if (isApiError(error) && (error.isUnauthorized || error.isForbidden)) {
        await this.end('expired');
        return false;
      }
      throw error;
    }
  }

  private update(next: SessionSnapshot) {
    this.snapshot = next;
    for (const listener of this.listeners) listener(next);
  }
}

function noop() {}
