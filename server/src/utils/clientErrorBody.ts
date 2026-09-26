/**
 * Shape of API error JSON returned to browsers.
 * Never includes Error.stack, filesystem paths, or other internals.
 * `error` mirrors the safe `message` because several dashboard clients
 * toast `response.data.error` (not `message`) on mutation failures.
 */
export type ClientErrorBody = {
  success: false;
  message: string;
  errors: unknown[];
  error: string;
};

export function buildClientErrorBody(message: string, errors: unknown[] = []): ClientErrorBody {
  return {
    success: false,
    message,
    errors,
    error: message,
  };
}
