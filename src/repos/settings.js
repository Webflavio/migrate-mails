const { query, queryOne, execute } = require("../db");
async function getSetting(key) {
  const row = await queryOne("SELECT setting_value FROM settings WHERE setting_key = ?", [key]);
  return row ? row.setting_value : null;
}
async function setSetting(key, value) {
  await execute(
    "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
    [key, value]
  );
}
async function getAllSettings() {
  const rows = await query("SELECT setting_key, setting_value FROM settings");
  return Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
}
module.exports = { getSetting, setSetting, getAllSettings };
