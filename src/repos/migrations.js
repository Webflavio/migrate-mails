const { getDb } = require("../db");
function createMigration(data) {
  const info = getDb().prepare(`
    INSERT INTO migrations (source_account_id, target_account_id, folder_mapping_json, duplicate_strategy, job_id, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(data.sourceAccountId, data.targetAccountId, JSON.stringify(data.folderMapping || {}), data.duplicateStrategy || "message_id", data.jobId || null);
  return getMigration(info.lastInsertRowid);
}
function getMigration(id) {
  const row = getDb().prepare(`
    SELECT m.*, sa.label AS source_label, ta.label AS target_label
    FROM migrations m
    JOIN accounts sa ON sa.id = m.source_account_id
    JOIN accounts ta ON ta.id = m.target_account_id
    WHERE m.id = ?
  `).get(id);
  if (row) row.folder_mapping = JSON.parse(row.folder_mapping_json);
  return row;
}
function listMigrations(limit) {
  const rows = getDb().prepare(`
    SELECT m.*, sa.label AS source_label, ta.label AS target_label
    FROM migrations m
    JOIN accounts sa ON sa.id = m.source_account_id
    JOIN accounts ta ON ta.id = m.target_account_id
    ORDER BY m.id DESC LIMIT ?
  `).all(limit || 20);
  return rows.map((row) => ({ ...row, folder_mapping: JSON.parse(row.folder_mapping_json) }));
}
function updateMigration(id, patch) {
  getDb().prepare(`
    UPDATE migrations SET status = COALESCE(@status, status),
      total_messages = COALESCE(@total_messages, total_messages),
      migrated_messages = COALESCE(@migrated_messages, migrated_messages),
      skipped_messages = COALESCE(@skipped_messages, skipped_messages),
      error_count = COALESCE(@error_count, error_count),
      finished_at = COALESCE(@finished_at, finished_at)
    WHERE id = @id
  `).run({ id, ...patch });
  return getMigration(id);
}
module.exports = { createMigration, getMigration, listMigrations, updateMigration };
