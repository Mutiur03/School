/**
 * Refresh-token sessions (table auth_sessions): one row per issued refresh token.
 *
 * - Login starts a family. Each refresh marks the presented row as replaced and issues a new
 *   row in the same family (rotation).
 * - Presenting a row that was already replaced is reuse: someone holds an old token. Inside a
 *   short grace window (two tabs or a retried request racing the same refresh) the caller gets
 *   another token in the same family; after it the whole family is revoked.
 * - Every query runs in an explicit RLS context for the token's school (or super-admin context
 *   for super_admin tokens, after the host check), so a token can only touch its own tenant's
 *   rows.
 */
import type { PrismaClient } from '@/generated/prisma/client.js';
import { runWithRlsContext } from '@/config/rlsContextStore.js';
import { REFRESH_TOKEN_TTL_MS, newTokenId, type AuthClient } from './auth-tokens.js';

export const REUSE_GRACE_MS = 30_000;

export interface SessionOwner {
  role: string;
  userId: number;
  /** null only for super_admin. */
  schoolId: number | null;
}

export type RotateResult =
  | { status: 'rotated'; familyId: string; jti: string }
  | { status: 'invalid' }
  | { status: 'reused' };

type Db = Pick<PrismaClient, 'auth_sessions'>;

export class AuthSessionStore {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private scoped<T>(owner: SessionOwner, fn: () => Promise<T>): Promise<T> {
    const isSuperAdmin = owner.role === 'super_admin';
    // `async/await` inside: Prisma promises are lazy and must start inside the ALS context.
    return runWithRlsContext(
      { schoolId: isSuperAdmin ? undefined : (owner.schoolId ?? undefined), isSuperAdmin },
      async () => await fn(),
    );
  }

  /** New session row. Pass familyId to continue a family (rotation), omit to start one. */
  async create(
    owner: SessionOwner,
    client: AuthClient,
    familyId?: string,
    jti: string = newTokenId(),
  ) {
    const family = familyId ?? newTokenId();
    await this.scoped(owner, () =>
      this.db.auth_sessions.create({
        data: {
          jti,
          family_id: family,
          user_role: owner.role,
          user_id: owner.userId,
          school_id: owner.role === 'super_admin' ? null : owner.schoolId,
          client,
          expires_at: new Date(this.now().getTime() + REFRESH_TOKEN_TTL_MS),
        },
      }),
    );
    return { jti, familyId: family };
  }

  /**
   * Consume `jti` and reserve `nextJti` as its replacement. The caller then creates the
   * `nextJti` row with the returned familyId.
   */
  rotate(owner: SessionOwner, client: AuthClient, jti: string, nextJti: string) {
    return this.scoped<RotateResult>(owner, async () => {
      const row = await this.db.auth_sessions.findUnique({ where: { jti } });
      const now = this.now();
      if (
        !row ||
        row.user_role !== owner.role ||
        row.user_id !== owner.userId ||
        (row.school_id ?? null) !== (owner.role === 'super_admin' ? null : owner.schoolId) ||
        row.client !== client ||
        row.revoked_at ||
        row.expires_at <= now
      ) {
        return { status: 'invalid' };
      }

      if (!row.replaced_by) {
        const claimed = await this.db.auth_sessions.updateMany({
          where: { jti, replaced_by: null, revoked_at: null },
          data: { replaced_by: nextJti, rotated_at: now },
        });
        if (claimed.count === 1)
          return { status: 'rotated', familyId: row.family_id, jti: nextJti };
      }

      // Already rotated (here or by a concurrent request).
      const current = row.replaced_by
        ? row
        : await this.db.auth_sessions.findUnique({ where: { jti } });
      const rotatedAt = current?.rotated_at?.getTime() ?? 0;
      if (current && !current.revoked_at && now.getTime() - rotatedAt <= REUSE_GRACE_MS) {
        return { status: 'rotated', familyId: row.family_id, jti: nextJti };
      }
      await this.revokeFamily(owner, row.family_id);
      return { status: 'reused' };
    });
  }

  revokeFamily(owner: SessionOwner, familyId: string) {
    return this.scoped(owner, () =>
      this.db.auth_sessions.updateMany({
        where: { family_id: familyId, revoked_at: null },
        data: { revoked_at: this.now() },
      }),
    );
  }

  /** Logout: revoke the family the presented token belongs to (if we know it). */
  async revokeByJti(owner: SessionOwner, jti: string) {
    const row = await this.scoped(owner, () =>
      this.db.auth_sessions.findUnique({ where: { jti } }),
    );
    if (row && row.user_role === owner.role && row.user_id === owner.userId) {
      await this.revokeFamily(owner, row.family_id);
    }
  }
}
