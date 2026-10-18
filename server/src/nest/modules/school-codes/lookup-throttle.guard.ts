import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import rateLimit, { type ClientRateLimitInfo, type Store } from 'express-rate-limit';
import type Redis from 'ioredis';
import { redis } from '@/config/redis.js';

export const LOOKUP_LIMIT = 10;
export const LOOKUP_WINDOW_MS = 15 * 60 * 1000;
export const LOOKUP_KEY_PREFIX = 'rl:school-code-lookup:';

/**
 * express-rate-limit store on the app's Redis, so the pre-auth budget is shared by every server
 * process (the in-memory stores used by the auth routes are per process).
 */
export class RedisWindowStore implements Store {
  prefix: string;
  private windowMs = LOOKUP_WINDOW_MS;

  constructor(
    private readonly client: Pick<Redis, 'multi' | 'decr' | 'del'>,
    prefix: string,
  ) {
    this.prefix = prefix;
  }

  init(options: { windowMs: number }) {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const k = this.prefix + key;
    const res = await this.client.multi().incr(k).pexpire(k, this.windowMs, 'NX').pttl(k).exec();
    if (!res) throw new Error('rate limit store: transaction aborted');
    const totalHits = Number(res[0]?.[1] ?? 0);
    const ttl = Number(res[2]?.[1] ?? this.windowMs);
    return { totalHits, resetTime: new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs)) };
  }

  async decrement(key: string) {
    await this.client.decr(this.prefix + key);
  }

  async resetKey(key: string) {
    await this.client.del(this.prefix + key);
  }
}

const TOO_MANY = 'Too many attempts. Please try again later.';

const limiter = rateLimit({
  windowMs: LOOKUP_WINDOW_MS,
  limit: LOOKUP_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new RedisWindowStore(redis, LOOKUP_KEY_PREFIX),
  handler: (_req, _res, next) => next(new HttpException(TOO_MANY, HttpStatus.TOO_MANY_REQUESTS)),
});

/** Per-IP budget for the public code lookup (10 per 15 min). Redis down = request fails. */
@Injectable()
export class LookupThrottleGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const http = ctx.switchToHttp();
    return new Promise<boolean>((resolve, reject) => {
      limiter(http.getRequest(), http.getResponse(), (err?: unknown) =>
        err ? reject(err) : resolve(true),
      );
    });
  }
}
