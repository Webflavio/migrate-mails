const fs = require("fs");
const path = require("path");
const config = require("../config");
const { hashContent } = require("../lib/crypto");
const { parseMessage } = require("../lib/parser");
const { saveRawMessage } = require("../lib/storage");
const foldersRepo = require("../repos/folders");
const messagesRepo = require("../repos/messages");
async function indexLegacyBackup(accountId, onProgress) {
  const legacyDir = config.legacyBackupPath;
  if (!fs.existsSync(legacyDir)) return { indexed: 0, skipped: 0 };
  let indexed = 0;
  let skipped = 0;
  const entries = fs.readdirSync(legacyDir, { withFileTypes: true });
  const pendingMessages = [];
  const flushPending = async () => {
    if (!pendingMessages.length) return;
    const attempted = pendingMessages.length;
    const inserted = await messagesRepo.insertMessageBatch(pendingMessages);
    pendingMessages.length = 0;
    indexed += inserted;
    skipped += attempted - inserted;
    if (onProgress) onProgress({ indexed, skipped });
  };
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folder = await foldersRepo.getOrCreateLegacyFolder(accountId, entry.name);
    const files = fs.readdirSync(path.join(legacyDir, entry.name)).filter((f) => f.endsWith(".eml") || f.endsWith(".mbox"));
    for (const file of files) {
      const full = path.join(legacyDir, entry.name, file);
      if (file.endsWith(".mbox")) continue;
      const buffer = fs.readFileSync(full);
      const contentHash = hashContent(buffer);
      const parsed = await parseMessage(buffer);
      const rawPath = saveRawMessage(accountId, folder.local_name, contentHash, buffer);
      pendingMessages.push({
        data: {
          account_id: accountId,
          folder_id: folder.id,
          uid: null,
          message_id: parsed.messageId,
          subject: parsed.subject,
          from_addr: parsed.from,
          to_addr: parsed.to,
          cc_addr: parsed.cc,
          bcc_addr: parsed.bcc,
          date_sent: parsed.dateSent,
          size_bytes: buffer.length,
          flags: null,
          raw_path: rawPath,
          content_hash: contentHash,
          has_attachments: parsed.attachments.length ? 1 : 0,
        },
        body: { ...parsed, subject: parsed.subject },
        attachments: parsed.attachments,
      });
      if (pendingMessages.length >= 100) await flushPending();
    }
  }
  await flushPending();
  return { indexed, skipped };
}
module.exports = { indexLegacyBackup };
