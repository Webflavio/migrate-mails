const { query, queryOne, execute } = require("../db");
async function createRun(accountId) {
  const info = await execute("INSERT INTO backup_runs (account_id, status) VALUES (?, 'running')", [accountId]);
  return getRun(info.lastInsertRowid);
}
async function getRun(id) {
  return queryOne("SELECT * FROM backup_runs WHERE id = ?", [id]);
}
async function updateRun(id, patch) {
  await execute(`
    UPDATE backup_runs SET status = COALESCE(?, status),
      finished_at = COALESCE(?, finished_at),
      total_folders = COALESCE(?, total_folders),
      total_messages = COALESCE(?, total_messages),
      new_messages = COALESCE(?, new_messages),
      error_count = COALESCE(?, error_count),
      error_log = COALESCE(?, error_log)
    WHERE id = ?
  `, [
    patch.status ?? null,
    patch.finished_at ?? null,
    patch.total_folders ?? null,
    patch.total_messages ?? null,
    patch.new_messages ?? null,
    patch.error_count ?? null,
    patch.error_log ?? null,
    id,
  ]);
  return getRun(id);
}
async function listRuns(accountId, limit) {
  if (accountId) {
    return query(`
      SELECT r.*, a.label AS account_label FROM backup_runs r
      JOIN accounts a ON a.id = r.account_id
      WHERE r.account_id = ? ORDER BY r.id DESC LIMIT ?
    `, [accountId, limit || 20]);
  }
  return query(`
    SELECT r.*, a.label AS account_label FROM backup_runs r
    JOIN accounts a ON a.id = r.account_id ORDER BY r.id DESC LIMIT ?
  `, [limit || 20]);
}
async function deleteRun(id) {
  return execute("DELETE FROM backup_runs WHERE id = ?", [id]);
}
async function deleteByAccount(accountId) {
  return execute("DELETE FROM backup_runs WHERE account_id = ?", [accountId]);
}
async function deleteOlderThan(days) {
  const info = await execute(`
    DELETE FROM backup_runs
    WHERE finished_at IS NOT NULL
      AND finished_at < DATE_SUB(NOW(), INTERVAL ? DAY)
  `, [days]);
  return info.changes;
}
module.exports = { createRun, getRun, updateRun, listRuns, deleteRun, deleteByAccount, deleteOlderThan };
