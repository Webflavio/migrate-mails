const { query, queryOne, execute } = require("../db");
async function createMigration(data) {
  const info = await execute(`
    INSERT INTO migrations (source_account_id, target_account_id, folder_mapping_json, duplicate_strategy, job_id, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `, [
    data.sourceAccountId,
    data.targetAccountId,
    JSON.stringify(data.folderMapping || {}),
    data.duplicateStrategy || "message_id",
    data.jobId || null,
  ]);
  return getMigration(info.lastInsertRowid);
}
async function getMigration(id) {
  const row = await queryOne(`
    SELECT m.*, sa.label AS source_label, ta.label AS target_label
    FROM migrations m
    JOIN accounts sa ON sa.id = m.source_account_id
    JOIN accounts ta ON ta.id = m.target_account_id
    WHERE m.id = ?
  `, [id]);
  if (row) row.folder_mapping = JSON.parse(row.folder_mapping_json);
  return row;
}
async function listMigrations(limit) {
  const rows = await query(`
    SELECT m.*, sa.label AS source_label, ta.label AS target_label
    FROM migrations m
    JOIN accounts sa ON sa.id = m.source_account_id
    JOIN accounts ta ON ta.id = m.target_account_id
    ORDER BY m.id DESC LIMIT ?
  `, [limit || 20]);
  return rows.map((row) => ({ ...row, folder_mapping: JSON.parse(row.folder_mapping_json) }));
}
async function updateMigration(id, patch) {
  await execute(`
    UPDATE migrations SET status = COALESCE(?, status),
      total_messages = COALESCE(?, total_messages),
      migrated_messages = COALESCE(?, migrated_messages),
      skipped_messages = COALESCE(?, skipped_messages),
      error_count = COALESCE(?, error_count),
      finished_at = COALESCE(?, finished_at)
    WHERE id = ?
  `, [
    patch.status ?? null,
    patch.total_messages ?? null,
    patch.migrated_messages ?? null,
    patch.skipped_messages ?? null,
    patch.error_count ?? null,
    patch.finished_at ?? null,
    id,
  ]);
  return getMigration(id);
}
module.exports = { createMigration, getMigration, listMigrations, updateMigration };
