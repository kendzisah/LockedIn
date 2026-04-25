/**
 * withResourceBundleSigningFix
 *
 * Xcode 14+ signs CocoaPods resource bundles by default, which requires a
 * development team to be set on every bundle target. Because Pods are
 * regenerated from scratch each prebuild, no team ever gets assigned to
 * them, and `xcodebuild archive` fails on EAS with:
 *   "Signing for <bundle> requires a development team."
 *
 * The fix: a post_install hook that disables code signing on bundle-product
 * targets only (leaves the main app + extensions alone). This is the
 * commonly-accepted workaround in the RN/Expo community.
 *
 * Implemented as a config plugin so `expo prebuild` preserves it.
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# withResourceBundleSigningFix';

const SNIPPET = `
  ${MARKER} — managed by config plugin
  installer.pods_project.targets.each do |target|
    if target.respond_to?(:product_type) && target.product_type == "com.apple.product-type.bundle"
      target.build_configurations.each do |bc|
        bc.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
      end
    end
  end
  # end ${MARKER}
`;

module.exports = function withResourceBundleSigningFix(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        'Podfile',
      );
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(MARKER)) return cfg;

      // Inject after the `react_native_post_install(...)` call inside the
      // existing `post_install do |installer|` block. Regex matches the
      // closing `)` of that call followed by a line with `end`.
      const replaced = contents.replace(
        /(react_native_post_install\([\s\S]*?\)\n)(\s*end)/,
        `$1${SNIPPET}$2`,
      );

      if (replaced === contents) {
        throw new Error(
          '[withResourceBundleSigningFix] failed to locate react_native_post_install(...) block in Podfile — plugin needs updating.',
        );
      }

      fs.writeFileSync(podfilePath, replaced);
      return cfg;
    },
  ]);
};
