import morgan from "morgan";
import logger from "../utils/logger.js";

// Fields that should never appear in logs
const SENSITIVE_FIELDS = new Set([
    "password",
    "passwordConfirm",
    "confirmPassword",
    "newPassword",
    "oldPassword",
    "token",
    "secret",
    "authorization",
]);

/**
 * Recursively redact sensitive keys from an object.
 */
const redact = (obj, depth = 0) => {
    if (depth > 5 || typeof obj !== "object" || obj === null) return obj;
    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [
            k,
            SENSITIVE_FIELDS.has(k.toLowerCase()) ? "[REDACTED]" : redact(v, depth + 1),
        ]),
    );
};

/**
 * Extract the real client IP, accounting for reverse proxies.
 */
const getClientIp = (req) =>
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown";

// ── Morgan middleware ────────────────────────────────────────────────────────
// Uses :method :url :status :res[content-length] - :response-time ms format
// and pipes the output to winston so it ends up in the log files.

const morganFormat =
    process.env.NODE_ENV === "development" ? "dev" : "combined";

export const morganMiddleware = morgan(morganFormat, {
    stream: logger.stream,
});

// ── Detailed request / response logger ──────────────────────────────────────
export const detailedRequestLogger = (req, res, next) => {
    const startAt = process.hrtime.bigint();

    // Capture the original end so we can intercept it.
    const originalEnd = res.end.bind(res);

    res.end = function (...args) {
        const durationMs = Number(process.hrtime.bigint() - startAt) / 1e6;
        const statusCode = res.statusCode;

        const logPayload = {
            type: "request",
            method: req.method,
            url: req.originalUrl || req.url,
            status: statusCode,
            duration_ms: parseFloat(durationMs.toFixed(2)),
            ip: getClientIp(req),
            user_agent: req.headers["user-agent"] || "unknown",
            content_length: res.getHeader("content-length") || null,
            ...(req.user
                ? { user: { id: req.user.id, role: req.user.role } }
                : {}),
            body:
                req.method !== "GET" && req.body && Object.keys(req.body).length > 0
                    ? redact(req.body)
                    : undefined,
        };

        if (statusCode >= 500) {
            logger.error("Server error response", logPayload);
        } else if (statusCode >= 400) {
            logger.warn("Client error response", logPayload);
        } else {
            logger.http("Request completed", logPayload);
        }

        return originalEnd(...args);
    };

    next();
};
