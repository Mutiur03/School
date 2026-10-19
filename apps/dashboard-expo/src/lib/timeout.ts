/**
 * Bound a promise in time without cancelling it. Startup work (SecureStore reads, the refresh
 * call, font loading) must never leave the app on a spinner forever; a timeout turns a hang into
 * an error the UI can offer Retry for.
 */
import { ApiError } from './api/errors';

export function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ApiError({ kind: 'timeout', message: `${what} took too long.`, path: what }));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
