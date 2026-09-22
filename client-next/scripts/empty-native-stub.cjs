// Stub for Node-native packages (sharp) that must not enter OpenNext/Workers bundles.
module.exports = function sharp() {
  throw new Error('Native module stub: not available in this runtime');
};
