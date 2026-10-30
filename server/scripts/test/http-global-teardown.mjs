/** Stops the fake R2/SMS server started by http-global-setup.mjs. The test DB is kept for reuse. */
export default async function globalTeardown() {
  await globalThis.__FAKE_R2_SMS__?.close();
}
