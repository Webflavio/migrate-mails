const { getDb } = require("../db");
const { encrypt, decrypt } = require("../lib/crypto");
function listAccounts() {
  return getDb().prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM messages m WHERE m.account_id = a.id) AS message_count,
      (SELECT COUNT(*) FROM folders f WHERE f.account_id = a.id) AS folder_count
    FROM accounts a ORDER BY a.label ASC
  `).all();
}
function getAccount(id) {
  return getDb().prepare("SELECT * FROM accounts WHERE id = ?").get(id);
}
function createAccount(data) {
  const stmt = getDb().prepare(`
    INSERT INTO accounts (label, imap_host, imap_port, imap_secure, username, password_enc, status)
    VALUES (@label, @imap_host, @imap_port, @imap_secure, @username, @password_enc, 'unknown')
  `);
  const info = stmt.run({
    label: data.label,
    imap_host: data.imap_host,
    imap_port: data.imap_port || 993,
    imap_secure: data.imap_secure !== false ? 1 : 0,
    username: data.username,
    password_enc: encrypt(data.password),
  });
  return getAccount(info.lastInsertRowid);
}
function updateAccount(id, data) {
  const current = getAccount(id);
  if (!current) return null;
  const passwordEnc = data.password ? encrypt(data.password) : current.password_enc;
  getDb().prepare(`
    UPDATE accounts SET label = @label, imap_host = @imap_host, imap_port = @imap_port,
      imap_secure = @imap_secure, username = @username, password_enc = @password_enc,
      updated_at = datetime('now') WHERE id = @id
  `).run({
    id,
    label: data.label ?? current.label,
    imap_host: data.imap_host ?? current.imap_host,
    imap_port: data.imap_port ?? current.imap_port,
    imap_secure: data.imap_secure !== undefined ? (data.imap_secure ? 1 : 0) : current.imap_secure,
    username: data.username ?? current.username,
    password_enc: passwordEnc,
  });
  return getAccount(id);
}
function deleteAccount(id) {
  return getDb().prepare("DELETE FROM accounts WHERE id = ?").run(id);
}
function setAccountStatus(id, status) {
  getDb().prepare("UPDATE accounts SET status = ?, last_tested_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(status, id);
}
function setLastBackup(id) {
  getDb().prepare("UPDATE accounts SET last_backup_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
}
function getPassword(account) {
  return decrypt(account.password_enc);
}
module.exports = { listAccounts, getAccount, createAccount, updateAccount, deleteAccount, setAccountStatus, setLastBackup, getPassword };
