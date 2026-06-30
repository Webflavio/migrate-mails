const fs = require("fs");
const path = require("path");
const config = require("../config");
const { getDb } = require("../db");
const accountsRepo = require("../repos/accounts");
const backupRunsRepo = require("../repos/backupRuns");
const jobsRepo = require("../repos/jobs");
function deleteRawFile(relativePath) {
  if (!relativePath) return;
  const full = path.join(config.root, relativePath);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}
function deleteAccountStorageDir(accountId) {
  const dir = path.join(config.storagePath, String(accountId));
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}
function deleteAccountBackupData(accountId) {
  const account = accountsRepo.getAccount(accountId);
  if (!account) throw new Error("Account not found");
  const messages = getDb().prepare("SELECT raw_path FROM messages WHERE account_id = ?").all(accountId);
  for (const row of messages) deleteRawFile(row.raw_path);
  getDb().prepare("DELETE FROM messages WHERE account_id = ?").run(accountId);
  getDb().prepare("DELETE FROM folders WHERE account_id = ?").run(accountId);
  backupRunsRepo.deleteByAccount(accountId);
  deleteAccountStorageDir(accountId);
  getDb().prepare("UPDATE accounts SET last_backup_at = NULL, updated_at = datetime('now') WHERE id = ?").run(accountId);
  return { accountId, deletedMessages: messages.length };
}
function deleteFolderBackupData(folderId) {
  const folder = getDb().prepare("SELECT * FROM folders WHERE id = ?").get(folderId);
  if (!folder) throw new Error("Folder not found");
  const messages = getDb().prepare("SELECT raw_path FROM messages WHERE folder_id = ?").all(folderId);
  for (const row of messages) deleteRawFile(row.raw_path);
  getDb().prepare("DELETE FROM messages WHERE folder_id = ?").run(folderId);
  getDb().prepare(`
    UPDATE folders SET message_count = 0, last_synced_at = NULL WHERE id = ?
  `).run(folderId);
  return { folderId, deletedMessages: messages.length };
}
function clearAllExports() {
  if (!fs.existsSync(config.exportPath)) return { deleted: 0 };
  let deleted = 0;
  for (const file of fs.readdirSync(config.exportPath)) {
    const full = path.join(config.exportPath, file);
    if (fs.statSync(full).isFile()) {
      fs.unlinkSync(full);
      deleted += 1;
    }
  }
  return { deleted };
}
function purgeOldJobs(days) {
  return jobsRepo.deleteOlderThan(days);
}
function purgeOldBackupRuns(days) {
  return backupRunsRepo.deleteOlderThan(days);
}
function purgeAllCompletedJobs() {
  return jobsRepo.deleteByStatuses(["completed", "failed", "cancelled"]);
}
function getAccountBackupStats(accountId) {
  const row = getDb().prepare(`
    SELECT COUNT(*) AS messages, COALESCE(SUM(size_bytes), 0) AS bytes
    FROM messages WHERE account_id = ?
  `).get(accountId);
  return { messages: row.messages || 0, bytes: row.bytes || 0 };
}
module.exports = {
  deleteAccountBackupData,
  deleteFolderBackupData,
  clearAllExports,
  purgeOldJobs,
  purgeOldBackupRuns,
  purgeAllCompletedJobs,
  getAccountBackupStats,
};
