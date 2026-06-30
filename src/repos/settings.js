const { getDb } = require("../db");
function getSetting(key) {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : null;
}
function setSetting(key, value) {
  getDb().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
function getAllSettings() {
  const rows = getDb().prepare("SELECT key, value FROM settings").all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
module.exports = { getSetting, setSetting, getAllSettings };
