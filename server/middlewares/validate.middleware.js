/**
 * Zod validation middleware factory.
 * Usage: validate(schema) — validates req.body against the given Zod schema.
 * On failure responds 400 with structured field errors.
 * On success, req.body is replaced with the parsed (trimmed/coerced) data.
 */
import { ApiError } from "../utils/ApiError.js";

export const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
        const fieldErrors = {};
        for (const issue of result.error.issues) {
            const field = issue.path.join(".") || "_root";
            if (!fieldErrors[field]) fieldErrors[field] = [];
            fieldErrors[field].push(issue.message);
        }

        return next(
            new ApiError(400, "Validation failed", result.error.issues)
        );
    }

    req.body = result.data; // replace with parsed/trimmed data
    next();
};
