import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.join(__dirname, "..", "logs");

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom format for console output (development)
const devConsoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    if (level === "\x1B[32mhttp\x1B[39m" || level === "http") {
      const { method, url, status, duration_ms } = meta;
      if (method && url) { 
        return `[${timestamp}] ${level}: ${method} ${url} ${status || ""} (${duration_ms || ""}ms)`;
      }
    }
    const metaStr =
      Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : "";
    return `[${timestamp}] ${level}: ${stack || message}${metaStr}`;
  }),
);

// Clean JSON format for file output (production / file logs)
const fileFormat = combine(
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  json(),
);

// ── Transports ──────────────────────────────────────────────────────────────

const consoleTransport = new winston.transports.Console({
  format:
    process.env.NODE_ENV === "development" ? devConsoleFormat : fileFormat,
  level: process.env.NODE_ENV === "development" ? "debug" : "http",
});

// All logs (info and above) rotating daily
const combinedRotateTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: "combined-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "30d",
  level: "info",
  format: fileFormat,
});

// Error-only rotating log
const errorRotateTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: "error-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "10m",
  maxFiles: "60d", // Keep error logs longer
  level: "error",
  format: fileFormat,
});

// HTTP access log (requests) rotating daily
const accessRotateTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: "access-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "50m",
  maxFiles: "14d",
  level: "http",
  format: fileFormat,
});

// ── Logger instance ─────────────────────────────────────────────────────────

const logger = winston.createLogger({
  levels: {
    ...winston.config.npm.levels,
    http: 3, // Sit right after info (2) and before verbose (4)
  },
  level: "http",
  transports: [
    consoleTransport,
    combinedRotateTransport,
    errorRotateTransport,
    accessRotateTransport,
  ],
  exitOnError: false,
});

// ── Convenience stream for morgan ───────────────────────────────────────────
(logger as any).stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export default logger;
