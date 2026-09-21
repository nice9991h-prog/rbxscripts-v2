const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, '.data');
const DB_PATH = path.join(DATA_DIR, 'site.sqlite');
const DEFAULT_CONFIG_PATH = path.join(ROOT, 'data', 'site-config.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schemaSql = `
  CREATE TABLE IF NOT EXISTS site_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    config_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

db.exec(schemaSql);

function readDefaultConfig() {
  try {
    const raw = fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

const hasConfig = db.prepare('SELECT 1 FROM site_config WHERE id = 1').get();
if (!hasConfig) {
  db.prepare('INSERT INTO site_config (id, config_json) VALUES (1, ?)').run(JSON.stringify(readDefaultConfig()));
}

function getConfig() {
  const row = db.prepare('SELECT config_json FROM site_config WHERE id = 1').get();
  return row ? JSON.parse(row.config_json) : readDefaultConfig();
}

function saveConfig(config) {
  db.prepare(`
    INSERT INTO site_config (id, config_json, updated_at)
    VALUES (1, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      config_json = excluded.config_json,
      updated_at = CURRENT_TIMESTAMP
  `).run(JSON.stringify(config));
  return getConfig();
}

function findAdmin(username) {
  return db.prepare('SELECT id, username, password_hash FROM admin_users WHERE username = ?').get(username);
}

function createAdmin(username, passwordHash) {
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
}

module.exports = { db, getConfig, saveConfig, findAdmin, createAdmin, DB_PATH };
