// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Only watch shared packages -- NOT the entire monorepo
config.watchFolders = [
  path.resolve(monorepoRoot, 'packages'),
];

// Resolve hoisted deps from both local and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Block admin and supabase directories from Metro file watchers
config.resolver.blockList = [
  /apps[\\/]admin[\\/].*/,
  /supabase[\\/].*/,
];

module.exports = config;
