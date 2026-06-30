const { getDb } = require("../db");
function upsertFolder(accountId, remoteName, localName, delimiter, uidValidity) {
  getDb().prepare(`
    INSERT INTO folders (account_id, remote_name, local_name, delimiter, uid_validity)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(account_id, remote_name) DO UPDATE SET
      local_name = excluded.local_name,
      delimiter = excluded.delimiter,
      uid_validity = COALESCE(excluded.uid_validity, folders.uid_validity)
  `).run(accountId, remoteName, localName, delimiter || "/", uidValidity || null);
  return getDb().prepare("SELECT * FROM folders WHERE account_id = ? AND remote_name = ?").get(accountId, remoteName);
}
function getFolder(id) {
  return getDb().prepare("SELECT * FROM folders WHERE id = ?").get(id);
}
function listFolders(accountId) {
  return getDb().prepare(`
    SELECT f.*, (SELECT COUNT(*) FROM messages m WHERE m.folder_id = f.id) AS backed_up_count
    FROM folders f WHERE f.account_id = ? ORDER BY f.remote_name ASC
  `).all(accountId);
}
function setIncluded(id, included) {
  getDb().prepare("UPDATE folders SET included = ? WHERE id = ?").run(included ? 1 : 0, id);
}
function setIncludedForAccount(accountId, remoteNames, included) {
  const stmt = getDb().prepare("UPDATE folders SET included = ? WHERE account_id = ? AND remote_name = ?");
  for (const name of remoteNames) stmt.run(included ? 1 : 0, accountId, name);
}
function getBackedUpCount(accountId, remoteName) {
  const row = getDb().prepare(`
    SELECT COUNT(*) AS total FROM messages m
    JOIN folders f ON f.id = m.folder_id
    WHERE f.account_id = ? AND f.remote_name = ?
  `).get(accountId, remoteName);
  return row ? row.total : 0;
}
function updateCounts(folderId, count) {
  getDb().prepare("UPDATE folders SET message_count = ?, last_synced_at = datetime('now') WHERE id = ?").run(count, folderId);
}
function getOrCreateLegacyFolder(accountId, folderName) {
  const existing = getDb().prepare("SELECT * FROM folders WHERE account_id = ? AND remote_name = ?").get(accountId, folderName);
  if (existing) return existing;
  return upsertFolder(accountId, folderName, folderName, "/");
}
module.exports = { upsertFolder, getFolder, listFolders, setIncluded, setIncludedForAccount, getBackedUpCount, updateCounts, getOrCreateLegacyFolder };
