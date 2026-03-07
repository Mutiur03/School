import { z } from "zod";
import logger from "../utils/logger.js";

const envSchema = z.object({
  PORT: z.string().default("5000"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1),
  REFRESH_TOKEN_SECRET: z.string().min(1),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  ALLOWED_ORIGINS: z.string().optional(),
  DOMAIN: z.string().optional(),

  // Google Sheets (Optional but checked if present)
  SHEET_ID: z.string().optional(),
  client_email: z.string().email().optional(),
  private_key: z.string().optional(),

  // SMS API
  BULK_SMS_API_KEY: z.string().optional(),
  BULK_SMS_SENDER_ID: z.string().optional(),

  // Storage
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_SECRET_KEY: z.string().optional(),
});

export const validateEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    result.error.issues.forEach((issue) => {
      console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
    });

    logger.error("Environment validation failed", {
      errors: result.error.format(),
    });

    process.exit(1);
  }

  return result.data;
};

export const env = validateEnv();
