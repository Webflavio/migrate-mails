const { getDb } = require("../db");
function createRun(accountId) {
  const info = getDb().prepare(`
    INSERT INTO backup_runs (account_id, status) VALUES (?, 'running')
  `).run(accountId);
  return getRun(info.lastInsertRowid);
}
function getRun(id) {
  return getDb().prepare("SELECT * FROM backup_runs WHERE id = ?").get(id);
}
function updateRun(id, patch) {
  getDb().prepare(`
    UPDATE backup_runs SET status = COALESCE(@status, status),
      finished_at = COALESCE(@finished_at, finished_at),
      total_folders = COALESCE(@total_folders, total_folders),
      total_messages = COALESCE(@total_messages, total_messages),
      new_messages = COALESCE(@new_messages, new_messages),
      error_count = COALESCE(@error_count, error_count),
      error_log = COALESCE(@error_log, error_log)
    WHERE id = @id
  `).run({ id, ...patch });
  return getRun(id);
}
function listRuns(accountId, limit) {
  if (accountId) {
    return getDb().prepare("SELECT * FROM backup_runs WHERE account_id = ? ORDER BY id DESC LIMIT ?").all(accountId, limit || 20);
  }
  return getDb().prepare(`
    SELECT r.*, a.label AS account_label FROM backup_runs r
    JOIN accounts a ON a.id = r.account_id ORDER BY r.id DESC LIMIT ?
  `).all(limit || 20);
}
module.exports = { createRun, getRun, updateRun, listRuns };
