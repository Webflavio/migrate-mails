const { query, queryOne, execute } = require("../db");
async function upsertFolder(accountId, remoteName, localName, delimiter, uidValidity) {
  await execute(`
    INSERT INTO folders (account_id, remote_name, local_name, delimiter, uid_validity)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      local_name = VALUES(local_name),
      delimiter = VALUES(delimiter),
      uid_validity = COALESCE(VALUES(uid_validity), uid_validity)
  `, [accountId, remoteName, localName, delimiter || "/", uidValidity || null]);
  return queryOne("SELECT * FROM folders WHERE account_id = ? AND remote_name = ?", [accountId, remoteName]);
}
async function getFolder(id) {
  return queryOne("SELECT * FROM folders WHERE id = ?", [id]);
}
async function listFolders(accountId) {
  return query(`
    SELECT f.*, (SELECT COUNT(*) FROM messages m WHERE m.folder_id = f.id) AS backed_up_count
    FROM folders f WHERE f.account_id = ? ORDER BY f.remote_name ASC
  `, [accountId]);
}
async function setIncluded(id, included) {
  await execute("UPDATE folders SET included = ? WHERE id = ?", [included ? 1 : 0, id]);
}
async function setIncludedForAccount(accountId, remoteNames, included) {
  for (const name of remoteNames) {
    await execute("UPDATE folders SET included = ? WHERE account_id = ? AND remote_name = ?", [included ? 1 : 0, accountId, name]);
  }
}
async function getBackedUpCount(accountId, remoteName) {
  const row = await queryOne(`
    SELECT COUNT(*) AS total FROM messages m
    JOIN folders f ON f.id = m.folder_id
    WHERE f.account_id = ? AND f.remote_name = ?
  `, [accountId, remoteName]);
  return row ? row.total : 0;
}
async function updateCounts(folderId, count) {
  await execute("UPDATE folders SET message_count = ?, last_synced_at = NOW() WHERE id = ?", [count, folderId]);
}
async function getOrCreateLegacyFolder(accountId, folderName) {
  const existing = await queryOne("SELECT * FROM folders WHERE account_id = ? AND remote_name = ?", [accountId, folderName]);
  if (existing) return existing;
  return upsertFolder(accountId, folderName, folderName, "/");
}
module.exports = { upsertFolder, getFolder, listFolders, setIncluded, setIncludedForAccount, getBackedUpCount, updateCounts, getOrCreateLegacyFolder };
