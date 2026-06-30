const { withClient } = require("../lib/imap");
const { hashContent } = require("../lib/crypto");
const { parseMessage } = require("../lib/parser");
const { saveRawMessage } = require("../lib/storage");
const { uniqueName } = require("../lib/safeName");
const config = require("../config");
const accountsRepo = require("../repos/accounts");
const foldersRepo = require("../repos/folders");
const messagesRepo = require("../repos/messages");
const backupRunsRepo = require("../repos/backupRuns");
async function runBackup(accountId, jobUpdate) {
  const account = accountsRepo.getAccount(accountId);
  if (!account) throw new Error("Account not found");
  const password = accountsRepo.getPassword(account);
  const run = backupRunsRepo.createRun(accountId);
  let totalMessages = 0;
  let newMessages = 0;
  let errorCount = 0;
  const errors = [];
  const usedNames = new Set();
  try {
    await withClient(account, password, async (client) => {
      const remoteFolders = [];
      for await (const box of client.list()) {
        remoteFolders.push({ name: box.path, delimiter: box.delimiter || "/" });
      }
      const totalFolders = remoteFolders.length;
      let folderIndex = 0;
      for (const remote of remoteFolders) {
        folderIndex += 1;
        const localName = uniqueName(remote.name, usedNames);
        const folder = foldersRepo.upsertFolder(accountId, remote.name, localName, remote.delimiter);
        if (folder.included === 0) continue;
        const lock = await client.getMailboxLock(remote.name);
        try {
          const status = await client.status(remote.name, { uidValidity: true, messages: true });
          foldersRepo.updateCounts(folder.id, status.messages || 0);
          const uidValidity = status.uidValidity;
          if (uidValidity) foldersRepo.upsertFolder(accountId, remote.name, localName, remote.delimiter, uidValidity);
          let count = 0;
          let newInFolder = 0;
          for await (const msg of client.fetch("1:*", { uid: true, source: true, flags: true })) {
            count += 1;
            const buffer = msg.source;
            if (buffer.length > config.maxMessageBytes) {
              errorCount += 1;
              errors.push(`Skipped oversized message in ${remote.name}`);
              continue;
            }
            const contentHash = hashContent(buffer);
            if (messagesRepo.existsByHash(accountId, folder.id, contentHash)) continue;
            const parsed = await parseMessage(buffer);
            const rawPath = saveRawMessage(accountId, localName, contentHash, buffer);
            const result = messagesRepo.insertMessage({
              account_id: accountId,
              folder_id: folder.id,
              uid: msg.uid,
              message_id: parsed.messageId,
              subject: parsed.subject,
              from_addr: parsed.from,
              to_addr: parsed.to,
              cc_addr: parsed.cc,
              bcc_addr: parsed.bcc,
              date_sent: parsed.dateSent,
              size_bytes: buffer.length,
              flags: JSON.stringify(Array.from(msg.flags || [])),
              raw_path: rawPath,
              content_hash: contentHash,
              has_attachments: parsed.attachments.length ? 1 : 0,
            });
            if (result.inserted) {
              messagesRepo.insertBody(result.id, { ...parsed, subject: parsed.subject });
              for (const att of parsed.attachments) messagesRepo.insertAttachment(result.id, att);
              newInFolder += 1;
              newMessages += 1;
            }
            totalMessages += 1;
          }
          if (jobUpdate) {
            const progress = Math.round((folderIndex / totalFolders) * 100);
            jobUpdate({ progress, result: { folder: remote.name, count, newInFolder } });
          }
        } finally {
          lock.release();
        }
      }
    });
    accountsRepo.setAccountStatus(accountId, "connected");
    accountsRepo.setLastBackup(accountId);
    backupRunsRepo.updateRun(run.id, {
      status: errorCount ? "completed_with_errors" : "completed",
      finished_at: new Date().toISOString(),
      total_folders: usedNames.size,
      total_messages: totalMessages,
      new_messages: newMessages,
      error_count: errorCount,
      error_log: errors.length ? errors.join("\n") : null,
    });
    return { runId: run.id, totalMessages, newMessages, errorCount };
  } catch (err) {
    backupRunsRepo.updateRun(run.id, {
      status: "failed",
      finished_at: new Date().toISOString(),
      error_count: errorCount + 1,
      error_log: err.message,
    });
    accountsRepo.setAccountStatus(accountId, "error");
    throw err;
  }
}
module.exports = { runBackup };
