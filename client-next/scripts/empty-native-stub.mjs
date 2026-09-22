/**
 * ESM twin of empty-native-stub.cjs — see that file for why we mock, not throw-on-load.
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

export default sharp;
