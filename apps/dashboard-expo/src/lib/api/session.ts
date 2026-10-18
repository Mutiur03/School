/**
 * In-memory session state + single-flight refresh. Mirrors the behaviour of the existing
 * dashboard (dashboard/src/context/unifiedAuthContext.tsx):
 * - access token in memory only;
 * - concurrent 401s share one refresh request;
 * - only an explicit 401/403 from refresh ends the session. Network errors, 5xx, 429 and 402
 *   keep it, so a flaky connection or a cold server is never a logout.
 */
import type { AuthHooks } from './client';
import { isSessionPayload, type AuthUser, type SessionPayload } from './auth';
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
  /** Performs the refresh call (cookie-based today). */
  refreshRequest: () => Promise<SessionPayload>;
  persistence: SessionPersistence;
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

  /** Apply a login or refresh response. */
  setSession(payload: SessionPayload) {
    this.accessToken = payload.accessToken;
    this.update({ status: 'authenticated', user: payload.user, endedReason: null });
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

  /** Local sign-out. Call the logout endpoint first when online so the cookie is cleared too. */
  async end(reason: 'signed-out' | 'expired'): Promise<void> {
    const previous = this.snapshot;
    this.accessToken = null;
    // Idempotent: a refresh 401 and the request that triggered it both report expiry.
    let endedReason: SessionSnapshot['endedReason'] = null;
    if (previous.status === 'authenticated' || reason === 'signed-out') endedReason = reason;
    else if (previous.status === 'anonymous') endedReason = previous.endedReason;
    // Update synchronously so concurrent requests stop sending the old token immediately.
    this.update({ status: 'anonymous', user: null, endedReason });
    await this.options.persistence.clear();
  }

  private async runRefresh(): Promise<boolean> {
    try {
      const payload = await this.options.refreshRequest();
      if (!isSessionPayload(payload)) {
        throw new ApiError({
          kind: 'parse',
          message: 'Refresh response did not contain a session.',
          path: 'refresh',
        });
      }
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
