// The runtime version (fingerprint) must not change when CI bumps android.versionCode per build,
// or no build would ever match a published OTA update. Keep Expo's default skips too.
const { DEFAULT_SOURCE_SKIPS, SourceSkips } = require('expo/fingerprint');

/** @type {import('expo/fingerprint').Config} */
module.exports = {
  sourceSkips: DEFAULT_SOURCE_SKIPS | SourceSkips.ExpoConfigVersions,
};
