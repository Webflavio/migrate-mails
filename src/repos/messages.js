const { query, queryOne, execute, transaction } = require("../db");
const insertSql = `
  INSERT IGNORE INTO messages (account_id, folder_id, uid, message_id, subject, from_addr, to_addr, cc_addr, bcc_addr,
    date_sent, size_bytes, flags, raw_path, content_hash, has_attachments)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
const insertBodySql = `
  INSERT INTO message_bodies (message_id, text_preview, html_available, search_text)
  VALUES (?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE text_preview = VALUES(text_preview),
    html_available = VALUES(html_available), search_text = VALUES(search_text)
`;
const insertAttachmentSql = `
  INSERT INTO attachments (message_id, filename, content_type, size_bytes, storage_path)
  VALUES (?, ?, ?, ?, ?)
`;
function messageParams(data) {
  return [
    data.account_id,
    data.folder_id,
    data.uid,
    data.message_id,
    data.subject,
    data.from_addr,
    data.to_addr,
    data.cc_addr,
    data.bcc_addr,
    data.date_sent,
    data.size_bytes,
    data.flags,
    data.raw_path,
    data.content_hash,
    data.has_attachments,
  ];
}
async function insertMessage(data) {
  const info = await execute(insertSql, messageParams(data));
  return { id: info.changes ? info.lastInsertRowid : null, inserted: info.changes > 0 };
}
async function insertBody(messageId, body) {
  await execute(insertBodySql, [messageId, body.textPreview, body.htmlAvailable, body.searchText]);
}
function buildSearchClause(q, params) {
  const terms = q.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return "";
  const parts = [];
  for (const term of terms) {
    const like = `%${term.replace(/"/g, "")}%`;
    parts.push("(m.subject LIKE ? OR m.from_addr LIKE ? OR m.to_addr LIKE ? OR b.search_text LIKE ?)");
    params.push(like, like, like, like);
  }
  return ` AND (${parts.join(" AND ")})`;
}
async function insertAttachment(messageId, attachment) {
  await execute(insertAttachmentSql, [
    messageId,
    attachment.filename,
    attachment.contentType,
    attachment.sizeBytes,
    attachment.storagePath || null,
  ]);
}
async function insertMessageBatch(items) {
  if (!items.length) return 0;
  return transaction(async (tx) => {
    let inserted = 0;
    for (const item of items) {
      const info = await tx.execute(insertSql, messageParams(item.data));
      if (!info.changes) continue;
      inserted += 1;
      const body = item.body || {};
      await tx.execute(insertBodySql, [info.lastInsertRowid, body.textPreview, body.htmlAvailable, body.searchText]);
      for (const att of item.attachments || []) {
        await tx.execute(insertAttachmentSql, [
          info.lastInsertRowid,
          att.filename,
          att.contentType,
          att.sizeBytes,
          att.storagePath || null,
        ]);
      }
    }
    return inserted;
  });
}
async function getMessage(id) {
  return queryOne(`
    SELECT m.*, f.remote_name AS folder_name, f.local_name, a.label AS account_label,
      b.text_preview, b.html_available, b.search_text
    FROM messages m
    JOIN folders f ON f.id = m.folder_id
    JOIN accounts a ON a.id = m.account_id
    LEFT JOIN message_bodies b ON b.message_id = m.id
    WHERE m.id = ?
  `, [id]);
}
async function getAttachments(messageId) {
  return query("SELECT * FROM attachments WHERE message_id = ?", [messageId]);
}
async function searchMessages(filters) {
  const params = [];
  let sql = `
    SELECT m.*, f.remote_name AS folder_name, a.label AS account_label
    FROM messages m
    JOIN folders f ON f.id = m.folder_id
    JOIN accounts a ON a.id = m.account_id
    LEFT JOIN message_bodies b ON b.message_id = m.id
    WHERE 1=1
  `;
  if (filters.accountId) { sql += " AND m.account_id = ?"; params.push(filters.accountId); }
  if (filters.folderId) { sql += " AND m.folder_id = ?"; params.push(filters.folderId); }
  if (filters.hasAttachments) { sql += " AND m.has_attachments = 1"; }
  if (filters.fromDate) { sql += " AND m.date_sent >= ?"; params.push(filters.fromDate); }
  if (filters.toDate) { sql += " AND m.date_sent <= ?"; params.push(filters.toDate); }
  if (filters.q) sql += buildSearchClause(filters.q, params);
  sql += " ORDER BY m.date_sent DESC, m.id DESC LIMIT ? OFFSET ?";
  params.push(filters.limit || 50, filters.offset || 0);
  return query(sql, params);
}
async function countMessages(filters) {
  const params = [];
  let sql = "SELECT COUNT(*) AS total FROM messages m LEFT JOIN message_bodies b ON b.message_id = m.id WHERE 1=1";
  if (filters.accountId) { sql += " AND m.account_id = ?"; params.push(filters.accountId); }
  if (filters.folderId) { sql += " AND m.folder_id = ?"; params.push(filters.folderId); }
  if (filters.hasAttachments) { sql += " AND m.has_attachments = 1"; }
  if (filters.q) sql += buildSearchClause(filters.q, params);
  const row = await queryOne(sql, params);
  return row.total;
}
async function listByFolder(folderId, limit, offset) {
  return query(`
    SELECT m.* FROM messages m WHERE m.folder_id = ? ORDER BY m.date_sent DESC, m.id DESC LIMIT ? OFFSET ?
  `, [folderId, limit || 50, offset || 0]);
}
async function existsByMessageId(accountId, messageId) {
  if (!messageId) return false;
  return !!(await queryOne("SELECT 1 AS ok FROM messages WHERE account_id = ? AND message_id = ? LIMIT 1", [accountId, messageId]));
}
async function existsByHash(accountId, folderId, hash) {
  return !!(await queryOne(
    "SELECT 1 AS ok FROM messages WHERE account_id = ? AND folder_id = ? AND content_hash = ? LIMIT 1",
    [accountId, folderId, hash]
  ));
}
async function listForExport(accountId, folderIds, messageIds) {
  if (messageIds && messageIds.length) {
    const placeholders = messageIds.map(() => "?").join(",");
    return query(`SELECT * FROM messages WHERE id IN (${placeholders})`, messageIds);
  }
  if (folderIds && folderIds.length) {
    const placeholders = folderIds.map(() => "?").join(",");
    return query(`SELECT * FROM messages WHERE account_id = ? AND folder_id IN (${placeholders})`, [accountId, ...folderIds]);
  }
  return query("SELECT * FROM messages WHERE account_id = ?", [accountId]);
}
async function getMaxUid(folderId) {
  const row = await queryOne("SELECT MAX(uid) AS maxUid FROM messages WHERE folder_id = ?", [folderId]);
  return row && row.maxUid ? row.maxUid : 0;
}
async function totalCount() {
  const row = await queryOne("SELECT COUNT(*) AS total FROM messages");
  return row.total;
}
module.exports = {
  insertMessage, insertBody, insertAttachment, insertMessageBatch, getMessage, getAttachments, searchMessages,
  countMessages, listByFolder, existsByMessageId, existsByHash, listForExport, getMaxUid, totalCount,
};
