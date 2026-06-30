const { getDb } = require("../db");
function insertMessage(data) {
  try {
    const info = getDb().prepare(`
      INSERT INTO messages (account_id, folder_id, uid, message_id, subject, from_addr, to_addr, cc_addr, bcc_addr,
        date_sent, size_bytes, flags, raw_path, content_hash, has_attachments)
      VALUES (@account_id, @folder_id, @uid, @message_id, @subject, @from_addr, @to_addr, @cc_addr, @bcc_addr,
        @date_sent, @size_bytes, @flags, @raw_path, @content_hash, @has_attachments)
    `).run(data);
    return { id: info.lastInsertRowid, inserted: true };
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return { id: null, inserted: false };
    throw err;
  }
}
function insertBody(messageId, body) {
  getDb().prepare(`
    INSERT INTO message_bodies (message_id, text_preview, html_available, search_text)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(message_id) DO UPDATE SET text_preview = excluded.text_preview,
      html_available = excluded.html_available, search_text = excluded.search_text
  `).run(messageId, body.textPreview, body.htmlAvailable, body.searchText);
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
function insertAttachment(messageId, attachment) {
  getDb().prepare(`
    INSERT INTO attachments (message_id, filename, content_type, size_bytes, storage_path)
    VALUES (?, ?, ?, ?, ?)
  `).run(messageId, attachment.filename, attachment.contentType, attachment.sizeBytes, attachment.storagePath || null);
}
function getMessage(id) {
  return getDb().prepare(`
    SELECT m.*, f.remote_name AS folder_name, f.local_name, a.label AS account_label,
      b.text_preview, b.html_available, b.search_text
    FROM messages m
    JOIN folders f ON f.id = m.folder_id
    JOIN accounts a ON a.id = m.account_id
    LEFT JOIN message_bodies b ON b.message_id = m.id
    WHERE m.id = ?
  `).get(id);
}
function getAttachments(messageId) {
  return getDb().prepare("SELECT * FROM attachments WHERE message_id = ?").all(messageId);
}
function searchMessages(filters) {
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
  return getDb().prepare(sql).all(...params);
}
function countMessages(filters) {
  const params = [];
  let sql = "SELECT COUNT(*) AS total FROM messages m LEFT JOIN message_bodies b ON b.message_id = m.id WHERE 1=1";
  if (filters.accountId) { sql += " AND m.account_id = ?"; params.push(filters.accountId); }
  if (filters.folderId) { sql += " AND m.folder_id = ?"; params.push(filters.folderId); }
  if (filters.hasAttachments) { sql += " AND m.has_attachments = 1"; }
  if (filters.q) sql += buildSearchClause(filters.q, params);
  return getDb().prepare(sql).get(...params).total;
}
function listByFolder(folderId, limit, offset) {
  return getDb().prepare(`
    SELECT m.* FROM messages m WHERE m.folder_id = ? ORDER BY m.date_sent DESC, m.id DESC LIMIT ? OFFSET ?
  `).all(folderId, limit || 50, offset || 0);
}
function existsByMessageId(accountId, messageId) {
  if (!messageId) return false;
  return !!getDb().prepare("SELECT 1 FROM messages WHERE account_id = ? AND message_id = ? LIMIT 1").get(accountId, messageId);
}
function existsByHash(accountId, folderId, hash) {
  return !!getDb().prepare("SELECT 1 FROM messages WHERE account_id = ? AND folder_id = ? AND content_hash = ? LIMIT 1").get(accountId, folderId, hash);
}
function listForExport(accountId, folderIds, messageIds) {
  if (messageIds && messageIds.length) {
    const placeholders = messageIds.map(() => "?").join(",");
    return getDb().prepare(`SELECT * FROM messages WHERE id IN (${placeholders})`).all(...messageIds);
  }
  if (folderIds && folderIds.length) {
    const placeholders = folderIds.map(() => "?").join(",");
    return getDb().prepare(`SELECT * FROM messages WHERE account_id = ? AND folder_id IN (${placeholders})`).all(accountId, ...folderIds);
  }
  return getDb().prepare("SELECT * FROM messages WHERE account_id = ?").all(accountId);
}
function totalCount() {
  return getDb().prepare("SELECT COUNT(*) AS total FROM messages").get().total;
}
module.exports = {
  insertMessage, insertBody, insertAttachment, getMessage, getAttachments, searchMessages,
  countMessages, listByFolder, existsByMessageId, existsByHash, listForExport, totalCount,
};
