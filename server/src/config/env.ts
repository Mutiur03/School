import { z } from 'zod';
import logger from '../utils/logger.js';

const envSchema = z.object({
  PORT: z.string().default('5000'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1),
  /** 32-byte key (64 hex chars) used to encrypt stored secrets like SMS API keys. Generate with `openssl rand -hex 32`. */
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex characters (32 bytes)'),
  /** Signs refresh tokens. Unset = falls back to JWT_SECRET with a startup warning (see docs/native-auth.md). */
  /** Host suffix for platform-subdomain schools in school-code lookups. Default: `-dashboard.mutiurrahman.com` in production, `.localhost` otherwise. */
  TENANT_HOST_SUFFIX: z.string().optional(),
  /**
   * Platform access code (XXX-XXXX, school-code alphabet). Typed or scanned in the app's school-code
   * box it opens super-admin sign-in; it never authorizes. Unset = off. See
   * nest/modules/school-codes/platform-code.ts for how to generate one.
   */
  PLATFORM_ACCESS_CODE: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ALLOWED_ORIGINS: z.string().optional(),
  DOMAIN: z.string().optional(),
  REDIS_HOST: z.string().optional(),

  SHORT_TERM_CACHE_TTL: z.coerce.number().int().positive().default(300),
  LONG_TERM_CACHE_TTL: z.coerce.number().int().positive().default(3600),

  // SMS API
  BULK_SMS_API_KEY: z.string().optional(),
  BULK_SMS_SENDER_IDS: z.string().optional(),
  /** Local SMS catcher (npx smspitt). When set, every send is captured there and nothing is delivered. */
  SMSPIT_URL: z.string().url().optional(),

  // Storage
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
  /** Local MinIO (or other S3) base URL. Unset keeps Cloudflare R2. */
  R2_ENDPOINT: z.string().url().optional(),

  // Email Configuration (Brevo)
  /** Local mail catcher (Mailpit). When set, every email is captured there and nothing is delivered. */
  MAILPIT_URL: z.string().url().optional(),
  BREVO_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().optional(),
  TO_EMAIL: z.string().email().optional(),

  SENTRY_DSN: z.string().url().optional(),

  PRISMA_LOG_QUERIES: z.enum(['true', 'false']).optional(),
  PRISMA_SLOW_QUERY_MS: z.string().optional(),

  /** Express trust proxy hops: "1" behind nginx only, "2" behind Cloudflare + nginx. Must equal the real hop count or req.ip is wrong/spoofable. "true"/"false" also accepted. */
  TRUST_PROXY: z.string().optional(),
});

export const validateEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    result.error.issues.forEach((issue) => {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    });

    logger.error('Environment validation failed', {
      errors: result.error.format(),
    });

    process.exit(1);
  }

  return result.data;
};

export const env = validateEnv();
