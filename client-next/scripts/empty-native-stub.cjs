/**
 * OpenNext/Workers stub for sharp.
 *
 * Next's getSharp() does `require('sharp')` then immediately calls
 * `.block` / `.unblock` / `.concurrency`. A bare throwing function makes
 * require succeed and then TypeErrors into a 500 on SSR.
 *
 * Provide those utilities as no-ops; only real image transforms throw.
 */
function unavailable() {
  throw new Error('sharp is not available in the Cloudflare Workers runtime');
}

function sharp() {
  return unavailable();
}

sharp.block = () => sharp;
sharp.unblock = () => sharp;
sharp.cache = () => sharp;
sharp.concurrency = () => 1;

module.exports = sharp;
