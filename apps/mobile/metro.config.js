// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Watch shared packages so Metro processes workspace imports
config.watchFolders = [
  path.resolve(monorepoRoot, 'packages'),
];

// Resolve hoisted deps from both local and root node_modules.
// This ensures imports from packages/* (e.g. @supabase/supabase-js
// imported from packages/supabase-client) resolve to the hoisted root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Block admin app and the top-level supabase CLI directory from Metro.
// IMPORTANT: Use absolute paths to avoid blocking node_modules/@supabase/*.
const adminDir = path.resolve(monorepoRoot, 'apps', 'admin').replace(/[\\\/]/g, '[\\\\/]');
const supabaseDir = path.resolve(monorepoRoot, 'supabase').replace(/[\\\/]/g, '[\\\\/]');

config.resolver.blockList = [
  new RegExp(`^${adminDir}[\\\\/].*`),
  new RegExp(`^${supabaseDir}[\\\\/].*`),
];

module.exports = config;
