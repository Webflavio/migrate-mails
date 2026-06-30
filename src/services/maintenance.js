const fs = require("fs");
const path = require("path");
const config = require("../config");
const { query, queryOne, execute } = require("../db");
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
async function deleteAccountBackupData(accountId) {
  const account = await accountsRepo.getAccount(accountId);
  if (!account) throw new Error("Account not found");
  const messages = await query("SELECT raw_path FROM messages WHERE account_id = ?", [accountId]);
  for (const row of messages) deleteRawFile(row.raw_path);
  await execute("DELETE FROM messages WHERE account_id = ?", [accountId]);
  await execute("DELETE FROM folders WHERE account_id = ?", [accountId]);
  await backupRunsRepo.deleteByAccount(accountId);
  deleteAccountStorageDir(accountId);
  await execute("UPDATE accounts SET last_backup_at = NULL, updated_at = NOW() WHERE id = ?", [accountId]);
  return { accountId, deletedMessages: messages.length };
}
async function deleteFolderBackupData(folderId) {
  const folder = await queryOne("SELECT * FROM folders WHERE id = ?", [folderId]);
  if (!folder) throw new Error("Folder not found");
  const messages = await query("SELECT raw_path FROM messages WHERE folder_id = ?", [folderId]);
  for (const row of messages) deleteRawFile(row.raw_path);
  await execute("DELETE FROM messages WHERE folder_id = ?", [folderId]);
  await execute("UPDATE folders SET message_count = 0, last_synced_at = NULL WHERE id = ?", [folderId]);
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
async function purgeOldJobs(days) {
  return jobsRepo.deleteOlderThan(days);
}
async function purgeOldBackupRuns(days) {
  return backupRunsRepo.deleteOlderThan(days);
}
async function purgeAllCompletedJobs() {
  return jobsRepo.deleteByStatuses(["completed", "failed", "cancelled"]);
}
async function getAccountBackupStats(accountId) {
  const row = await queryOne(`
    SELECT COUNT(*) AS messages, COALESCE(SUM(size_bytes), 0) AS bytes
    FROM messages WHERE account_id = ?
  `, [accountId]);
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
