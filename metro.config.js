// metro.config.js
const { getDefaultConfig } = require('@expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

module.exports = {
  ...defaultConfig,
  watcher: {
    ...defaultConfig.watcher,
    unstable_lazySha1: true, // Enable lazy SHA1 computation for better performance
  }
};