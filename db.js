const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'site-config.json');
const TEMP_PATH = `${CONFIG_PATH}.tmp`;
const DEFAULT_CONFIG_PATH = CONFIG_PATH;

fs.mkdirSync(DATA_DIR, { recursive: true });

function readDefaultConfig() {
  try {
    return JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function getConfig() {
  return readDefaultConfig();
}

function saveConfig(config) {
  const serialized = `${JSON.stringify(config, null, 2)}\n`;
  fs.writeFileSync(TEMP_PATH, serialized, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(TEMP_PATH, CONFIG_PATH);
  return getConfig();
}

module.exports = { getConfig, saveConfig };
