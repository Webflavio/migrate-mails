const { query, queryOne, execute } = require("../db");
const { encrypt, decrypt } = require("../lib/crypto");
async function listAccounts() {
  return query(`
    SELECT a.*,
      (SELECT COUNT(*) FROM messages m WHERE m.account_id = a.id) AS message_count,
      (SELECT COUNT(*) FROM folders f WHERE f.account_id = a.id) AS folder_count
    FROM accounts a ORDER BY a.label ASC
  `);
}
async function getAccount(id) {
  return queryOne("SELECT * FROM accounts WHERE id = ?", [id]);
}
async function createAccount(data) {
  const info = await execute(`
    INSERT INTO accounts (label, imap_host, imap_port, imap_secure, username, password_enc, status)
    VALUES (?, ?, ?, ?, ?, ?, 'unknown')
  `, [
    data.label,
    data.imap_host,
    data.imap_port || 993,
    data.imap_secure !== false ? 1 : 0,
    data.username,
    encrypt(data.password),
  ]);
  return getAccount(info.lastInsertRowid);
}
async function updateAccount(id, data) {
  const current = await getAccount(id);
  if (!current) return null;
  const passwordEnc = data.password ? encrypt(data.password) : current.password_enc;
  await execute(`
    UPDATE accounts SET label = ?, imap_host = ?, imap_port = ?,
      imap_secure = ?, username = ?, password_enc = ?,
      updated_at = NOW() WHERE id = ?
  `, [
    data.label ?? current.label,
    data.imap_host ?? current.imap_host,
    data.imap_port ?? current.imap_port,
    data.imap_secure !== undefined ? (data.imap_secure ? 1 : 0) : current.imap_secure,
    data.username ?? current.username,
    passwordEnc,
    id,
  ]);
  return getAccount(id);
}
async function deleteAccount(id) {
  return execute("DELETE FROM accounts WHERE id = ?", [id]);
}
async function setAccountStatus(id, status) {
  await execute("UPDATE accounts SET status = ?, last_tested_at = NOW(), updated_at = NOW() WHERE id = ?", [status, id]);
}
async function setLastBackup(id) {
  await execute("UPDATE accounts SET last_backup_at = NOW(), updated_at = NOW() WHERE id = ?", [id]);
}
function getPassword(account) {
  return decrypt(account.password_enc);
}
module.exports = { listAccounts, getAccount, createAccount, updateAccount, deleteAccount, setAccountStatus, setLastBackup, getPassword };
