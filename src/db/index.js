const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const config = require("../config");
const { runMigrations } = require("./migrate");
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
const state = global.__mailvaultDbState || { db: null };
global.__mailvaultDbState = state;
function getDb() {
  if (state.db) return state.db;
  throw new Error("Database not initialized. Call initDb() first.");
}
async function initDb() {
  if (state.db) return state.db;
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = new Database(config.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("temp_store = MEMORY");
  db.pragma("foreign_keys = ON");
  db.exec(schema);
  runMigrations(db);
  const defaults = [
    ["storage_path", config.storagePath],
    ["export_path", config.exportPath],
    ["export_retention_days", String(config.exportRetentionDays)],
    ["max_message_mb", String(config.maxMessageBytes / 1024 / 1024)],
  ];
  const upsert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING");
  for (const row of defaults) upsert.run(row);
  state.db = db;
  return db;
}
function closeDb() {
  if (state.db) {
    state.db.close();
    state.db = null;
  }
}
module.exports = { getDb, initDb, closeDb };
