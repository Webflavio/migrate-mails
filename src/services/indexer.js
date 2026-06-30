const fs = require("fs");
const path = require("path");
const config = require("../config");
const { hashContent } = require("../lib/crypto");
const { parseMessage } = require("../lib/parser");
const { saveRawMessage } = require("../lib/storage");
const { uniqueName } = require("../lib/safeName");
const accountsRepo = require("../repos/accounts");
const foldersRepo = require("../repos/folders");
const messagesRepo = require("../repos/messages");
async function indexLegacyBackup(accountId, onProgress) {
  const legacyDir = config.legacyBackupPath;
  if (!fs.existsSync(legacyDir)) return { indexed: 0, skipped: 0 };
  let indexed = 0;
  let skipped = 0;
  const entries = fs.readdirSync(legacyDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folder = foldersRepo.getOrCreateLegacyFolder(accountId, entry.name);
    const files = fs.readdirSync(path.join(legacyDir, entry.name)).filter((f) => f.endsWith(".eml") || f.endsWith(".mbox"));
    for (const file of files) {
      const full = path.join(legacyDir, entry.name, file);
      if (file.endsWith(".mbox")) continue;
      const buffer = fs.readFileSync(full);
      const contentHash = hashContent(buffer);
      if (messagesRepo.existsByHash(accountId, folder.id, contentHash)) {
        skipped += 1;
        continue;
      }
      const parsed = await parseMessage(buffer);
      const rawPath = saveRawMessage(accountId, folder.local_name, contentHash, buffer);
      const result = messagesRepo.insertMessage({
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
      });
      if (result.inserted) {
        messagesRepo.insertBody(result.id, { ...parsed, subject: parsed.subject });
        for (const att of parsed.attachments) messagesRepo.insertAttachment(result.id, att);
        indexed += 1;
      } else skipped += 1;
      if (onProgress) onProgress({ indexed, skipped });
    }
  }
  return { indexed, skipped };
}
module.exports = { indexLegacyBackup };
