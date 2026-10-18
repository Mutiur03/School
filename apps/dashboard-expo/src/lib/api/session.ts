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
import { isSessionPayload, type AuthUser, type SessionPayload, type TokenTransport } from './auth';
import { ApiError, isApiError } from './errors';
import type { SessionPersistence } from './token-store';

export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

export interface SessionSnapshot {
  status: SessionStatus;
  user: AuthUser | null;
  /** Why the last session ended, for UI messaging. */
  endedReason: 'signed-out' | 'expired' | null;
}

export interface SessionManagerOptions {
  /** Performs the refresh call. Body transport passes the stored refresh token. */
  refreshRequest: (refreshToken?: string) => Promise<SessionPayload>;
  persistence: SessionPersistence;
  /** Default 'cookie' (web). */
  transport?: TokenTransport;
}

type Listener = (snapshot: SessionSnapshot) => void;

export class SessionManager implements AuthHooks {
  private accessToken: string | null = null;
  private snapshot: SessionSnapshot = { status: 'unknown', user: null, endedReason: null };
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
    this.update({ status: 'authenticated', user: payload.user, endedReason: null });
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
   * Startup probe: try to restore a session from the refresh cookie. Transport failures leave
   * the status `unknown` so the UI can show "offline" instead of a login prompt.
   */
  async bootstrap(): Promise<void> {
    try {
      const ok = await this.refresh();
      if (!ok && this.snapshot.status === 'unknown') {
        this.update({ status: 'anonymous', user: null, endedReason: null });
      }
    } catch (error) {
      if (isApiError(error) && error.isTransport) return;
      // 404/5xx/parse (e.g. no backend behind this origin): treat as signed out for now.
      if (this.snapshot.status === 'unknown') {
        this.update({ status: 'anonymous', user: null, endedReason: null });
      }
    }
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
      this.update({ status: 'unknown', user: null, endedReason: null });
      return;
    }
    this.update({ status: 'anonymous', user: null, endedReason });
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
      savedAt: Date.now(),
    });
  }

  private async runRefresh(): Promise<boolean> {
    try {
      let stored: string | undefined;
      if (this.transport === 'body') {
        stored = (await this.options.persistence.load())?.refreshToken;
        // Nothing stored: signed out, no request needed.
        if (!stored) {
          await this.end('expired');
          return false;
        }
      }
      const payload = await this.options.refreshRequest(stored);
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
