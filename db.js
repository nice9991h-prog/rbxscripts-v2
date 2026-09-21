const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'site-config.json');
const TEMP_PATH = `${CONFIG_PATH}.tmp`;

fs.mkdirSync(DATA_DIR, { recursive: true });

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  fs.writeFileSync(TEMP_PATH, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600
  });
  fs.renameSync(TEMP_PATH, CONFIG_PATH);
  return readConfig();
}

module.exports = { readConfig, writeConfig };
