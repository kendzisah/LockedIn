/**
 * withDeviceActivityMonitor
 *
 * Expo config plugin that wires up the iOS DeviceActivityMonitor extension
 * needed to un-shield apps at the scheduled session end time even when the
 * main app has been killed by iOS.
 *
 * What this plugin does on `expo prebuild`:
 *
 *  1. Adds the App Group entitlement to the main app so it shares a
 *     UserDefaults suite with the extension.
 *  2. Copies the extension's Swift sources out of
 *     `modules/screen-time/ios/extension/` (and `SharedScreenTimeConstants.swift`)
 *     into `ios/LockedInDeviceActivityMonitor/`.
 *  3. Generates an Info.plist and entitlements file for the extension target.
 *  4. Adds a new PBXNativeTarget (`LockedInDeviceActivityMonitor`) to the
 *     Xcode project with the correct extension build settings, links the
 *     required system frameworks, and embeds it in the main app bundle.
 *
 * Manual steps the developer still has to take once, outside this plugin:
 *  - Register the App Group `group.com.flocktechnologies.lockedin` in the
 *    Apple Developer portal under both the main app identifier and the
 *    extension identifier (`*.DeviceActivityMonitor`).
 *  - Enable the Family Controls capability for both identifiers.
 *  - With automatic signing, Xcode will pick these up from the entitlement
 *    files; with manual signing, you must add matching provisioning profiles.
 */

const {
  withEntitlementsPlist,
  withXcodeProject,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const EXTENSION_TARGET_NAME = 'LockedInDeviceActivityMonitor';
const APP_GROUP_ID = 'group.com.flocktechnologies.lockedin';
const DEPLOYMENT_TARGET = '16.0';

/** Add App Group entitlement to the main app target. */
const withMainAppGroup = (config) =>
  withEntitlementsPlist(config, (cfg) => {
    const ent = cfg.modResults;
    const groups = new Set(ent['com.apple.security.application-groups'] || []);
    groups.add(APP_GROUP_ID);
    ent['com.apple.security.application-groups'] = Array.from(groups);
    return cfg;
  });

/** Copy Swift sources + write Info.plist and entitlements for the extension. */
const withExtensionSources = (config) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const targetDir = path.join(iosRoot, EXTENSION_TARGET_NAME);
      fs.mkdirSync(targetDir, { recursive: true });

      const moduleIosDir = path.join(
        projectRoot,
        'modules',
        'screen-time',
        'ios',
      );
      const sources = [
        {
          src: path.join(moduleIosDir, 'SharedScreenTimeConstants.swift'),
          dst: path.join(targetDir, 'SharedScreenTimeConstants.swift'),
        },
        {
          src: path.join(
            moduleIosDir,
            'extension',
            'LockedInDeviceActivityMonitor.swift',
          ),
          dst: path.join(targetDir, 'LockedInDeviceActivityMonitor.swift'),
        },
      ];

      for (const { src, dst } of sources) {
        if (!fs.existsSync(src)) {
          throw new Error(
            `[withDeviceActivityMonitor] expected source missing: ${src}`,
          );
        }
        fs.copyFileSync(src, dst);
      }

      const bundleId = `${cfg.ios?.bundleIdentifier ?? 'com.flocktechnologies.lockedin'}.DeviceActivityMonitor`;

      const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleDisplayName</key>
    <string>LockedIn Monitor</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.deviceactivity.monitor-extension</string>
        <key>NSExtensionPrincipalClass</key>
        <string>$(PRODUCT_MODULE_NAME).LockedInDeviceActivityMonitor</string>
    </dict>
</dict>
</plist>
`;
      fs.writeFileSync(path.join(targetDir, 'Info.plist'), infoPlist);

      const entitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.family-controls</key>
    <true/>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>${APP_GROUP_ID}</string>
    </array>
</dict>
</plist>
`;
      fs.writeFileSync(
        path.join(targetDir, `${EXTENSION_TARGET_NAME}.entitlements`),
        entitlements,
      );

      // Unused — kept for explicitness in case Xcode asks for a bridging header later.
      void bundleId;
      return cfg;
    },
  ]);

/** Wire the extension target into the Xcode project. Idempotent. */
const withExtensionTarget = (config) =>
  withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults;

    // Idempotency: if a target with this name already exists, bail.
    const existing = proj.pbxNativeTargetSection();
    for (const key of Object.keys(existing)) {
      const t = existing[key];
      if (t && typeof t === 'object' && t.name === EXTENSION_TARGET_NAME) {
        return cfg;
      }
    }

    const bundleId = `${cfg.ios?.bundleIdentifier ?? 'com.flocktechnologies.lockedin'}.DeviceActivityMonitor`;

    // Create the target. `app_extension` type sets the right product type
    // (com.apple.product-type.app-extension) and wrapper extension (.appex).
    const target = proj.addTarget(
      EXTENSION_TARGET_NAME,
      'app_extension',
      EXTENSION_TARGET_NAME,
      bundleId,
    );

    proj.addBuildPhase(
      [],
      'PBXSourcesBuildPhase',
      'Sources',
      target.uuid,
    );
    proj.addBuildPhase(
      [],
      'PBXResourcesBuildPhase',
      'Resources',
      target.uuid,
    );
    proj.addBuildPhase(
      [],
      'PBXFrameworksBuildPhase',
      'Frameworks',
      target.uuid,
    );

    const pbxGroupKey = proj.pbxCreateGroup(
      EXTENSION_TARGET_NAME,
      EXTENSION_TARGET_NAME,
    );
    // Attach the new group to the top-level "CustomTemplate" group so it
    // shows up in the project navigator alongside the main app sources.
    const rootGroup = proj.findPBXGroupKey({ name: 'CustomTemplate' });
    if (rootGroup) {
      proj.addToPbxGroup(pbxGroupKey, rootGroup);
    }

    proj.addSourceFile(
      `${EXTENSION_TARGET_NAME}/SharedScreenTimeConstants.swift`,
      { target: target.uuid },
      pbxGroupKey,
    );
    proj.addSourceFile(
      `${EXTENSION_TARGET_NAME}/LockedInDeviceActivityMonitor.swift`,
      { target: target.uuid },
      pbxGroupKey,
    );
    // Info.plist and entitlements are referenced via build settings
    // (INFOPLIST_FILE / CODE_SIGN_ENTITLEMENTS) rather than as file
    // references — adding them via addResourceFile/addFile fails on a
    // freshly-created target that has no Resources group wired yet.

    // Link system frameworks (DeviceActivity, ManagedSettings, FamilyControls).
    const frameworks = ['DeviceActivity', 'ManagedSettings', 'FamilyControls'];
    for (const fw of frameworks) {
      proj.addFramework(`System/Library/Frameworks/${fw}.framework`, {
        target: target.uuid,
        sourceTree: 'SDKROOT',
      });
    }

    // Development team must be inherited from the main app — automatic signing
    // on the extension target still needs a team ID to pick a profile.
    const appleTeamId = cfg.ios?.appleTeamId;
    if (!appleTeamId) {
      throw new Error(
        '[withDeviceActivityMonitor] ios.appleTeamId is required in app.json so the extension target can be signed.',
      );
    }

    // Tune build settings on every config (Debug/Release) of the new target.
    const configSection = proj.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configSection)) {
      const item = configSection[key];
      if (
        item &&
        typeof item === 'object' &&
        item.buildSettings &&
        item.buildSettings.PRODUCT_NAME &&
        String(item.buildSettings.PRODUCT_NAME).includes(
          EXTENSION_TARGET_NAME,
        )
      ) {
        const bs = item.buildSettings;
        bs.IPHONEOS_DEPLOYMENT_TARGET = DEPLOYMENT_TARGET;
        bs.SWIFT_VERSION = '5.9';
        bs.INFOPLIST_FILE = `${EXTENSION_TARGET_NAME}/Info.plist`;
        bs.CODE_SIGN_ENTITLEMENTS = `${EXTENSION_TARGET_NAME}/${EXTENSION_TARGET_NAME}.entitlements`;
        bs.CODE_SIGN_STYLE = 'Automatic';
        bs.DEVELOPMENT_TEAM = appleTeamId;
        bs.TARGETED_DEVICE_FAMILY = '"1,2"';
        bs.SKIP_INSTALL = 'YES';
        bs.PRODUCT_BUNDLE_IDENTIFIER = bundleId;
        bs.CURRENT_PROJECT_VERSION = '1';
        bs.MARKETING_VERSION = '1.0';
      }
    }

    // Embed the extension into the main app's .app bundle via a
    // "PBXCopyFilesBuildPhase" with subfolder spec 13 (PlugIns/).
    const mainTargetName = proj.getFirstTarget().firstTarget.name;
    const embedPhase = proj.addBuildPhase(
      [],
      'PBXCopyFilesBuildPhase',
      'Embed App Extensions',
      proj.getFirstTarget().uuid,
      'app_extension',
    );
    // The `addBuildPhase` call with type `app_extension` sets the destination
    // to PlugIns and RUN_ONLY_FOR_DEPLOYMENT_POSTPROCESSING=0 correctly; we
    // just need to add the extension's .appex product ref to this phase.
    if (embedPhase && embedPhase.buildPhase) {
      // The product reference for the extension is auto-created by
      // addTarget(). Locate and add it to the embed phase.
      const products = proj.pbxFileReferenceSection();
      for (const key of Object.keys(products)) {
        const ref = products[key];
        if (
          ref &&
          typeof ref === 'object' &&
          ref.path &&
          String(ref.path) === `${EXTENSION_TARGET_NAME}.appex`
        ) {
          embedPhase.buildPhase.files.push({
            value: key,
            comment: `${EXTENSION_TARGET_NAME}.appex in Embed App Extensions`,
            settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
          });
          break;
        }
      }
    }
    void mainTargetName;

    return cfg;
  });

module.exports = function withDeviceActivityMonitor(config) {
  config = withMainAppGroup(config);
  config = withExtensionSources(config);
  config = withExtensionTarget(config);
  return config;
};
