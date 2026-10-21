// expo-splash-screen always points windowSplashScreenAnimatedIcon at @drawable/splashscreen_logo,
// which only exists when a splash `image` is configured. We want the Android 12+ system look
// (launcher adaptive icon, launcher shape and size) like a build without the plugin, so point the
// splash icon at the adaptive launcher icon instead.
const { withAndroidStyles } = require('expo/config-plugins');

module.exports = function withLauncherIconSplash(config) {
  return withAndroidStyles(config, (cfg) => {
    for (const style of cfg.modResults.resources.style ?? []) {
      if (style.$?.name !== 'Theme.App.SplashScreen') continue;
      for (const item of style.item ?? []) {
        if (item.$?.name === 'windowSplashScreenAnimatedIcon') item._ = '@mipmap/ic_launcher';
      }
    }
    return cfg;
  });
};
