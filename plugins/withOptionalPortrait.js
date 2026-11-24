// Keeps the portrait lock but stops Google Play from treating portrait screen
// hardware as required, which would hide the app from some devices.
const { withAndroidManifest } = require('expo/config-plugins');

const FEATURE = 'android.hardware.screen.portrait';

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const { manifest } = cfg.modResults;
    const features = (manifest['uses-feature'] || []).filter(
      (f) => f.$?.['android:name'] !== FEATURE,
    );
    features.push({ $: { 'android:name': FEATURE, 'android:required': 'false' } });
    manifest['uses-feature'] = features;
    return cfg;
  });
};
