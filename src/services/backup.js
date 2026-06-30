const { withClient, listMailboxes } = require("../lib/imap");
const { hashContent } = require("../lib/crypto");
const { metadataFromFetch } = require("../lib/envelope");
const { parseMessage } = require("../lib/parser");
const { formatBytes } = require("../lib/formatBytes");
const { saveRawMessage } = require("../lib/storage");
const { uniqueName } = require("../lib/safeName");
const config = require("../config");
const accountsRepo = require("../repos/accounts");
const foldersRepo = require("../repos/folders");
const messagesRepo = require("../repos/messages");
const backupRunsRepo = require("../repos/backupRuns");
const jobsRepo = require("../repos/jobs");
function createLogger(jobId, jobUpdate) {
  return (line) => {
    if (jobId) jobsRepo.appendLog(jobId, line);
    if (jobUpdate) jobUpdate({ log: line });
  };
}
function assertNotCancelled(jobId) {
  if (jobId && jobsRepo.isCancelled(jobId)) {
    throw new Error("Job cancelled by user");
  }
}
async function runBackup(accountId, jobUpdate, jobId, options) {
  const account = accountsRepo.getAccount(accountId);
  if (!account) throw new Error("Account not found");
  const password = accountsRepo.getPassword(account);
  const log = createLogger(jobId, jobUpdate);
  const folderFilter = options && options.folderNames && options.folderNames.length ? options.folderNames : null;
  const incremental = !options || options.incremental !== false;
  const run = backupRunsRepo.createRun(accountId);
  let totalMessages = 0;
  let newMessages = 0;
  let errorCount = 0;
  const errors = [];
  const usedNames = new Set();
  log(`Backup started for ${account.label}`);
  try {
    await withClient(account, password, async (client) => {
      const boxes = await listMailboxes(client);
      let remoteFolders = boxes.map((box) => ({ name: box.path, delimiter: box.delimiter || "/" }));
      if (folderFilter) {
        remoteFolders = remoteFolders.filter((f) => folderFilter.includes(f.name));
        log(`Selected ${remoteFolders.length} folder(s)`);
      }
      const totalFolders = remoteFolders.length;
      let folderIndex = 0;
      for (const remote of remoteFolders) {
        assertNotCancelled(jobId);
        folderIndex += 1;
        const localName = uniqueName(remote.name, usedNames);
        const folder = foldersRepo.upsertFolder(accountId, remote.name, localName, remote.delimiter);
        if (!folderFilter && folder.included === 0) {
          log(`Skipping excluded folder ${remote.name}`);
          continue;
        }
        log(`[${folderIndex}/${totalFolders}] Opening ${remote.name}`);
        const lock = await client.getMailboxLock(remote.name);
        try {
          const status = await client.status(remote.name, { uidValidity: true, messages: true });
          foldersRepo.updateCounts(folder.id, status.messages || 0);
          if (status.uidValidity) {
            foldersRepo.upsertFolder(accountId, remote.name, localName, remote.delimiter, status.uidValidity);
          }
          const lastUid = incremental ? messagesRepo.getMaxUid(folder.id) : 0;
          const range = lastUid > 0 ? `${lastUid + 1}:*` : "1:*";
          if (lastUid > 0) log(`Incremental sync from UID ${lastUid + 1} in ${remote.name}`);
          let count = 0;
          let newInFolder = 0;
          let folderBytes = 0;
          for await (const msg of client.fetch(range, { uid: true, source: true, flags: true, envelope: true, bodyStructure: true })) {
            assertNotCancelled(jobId);
            count += 1;
            const buffer = msg.source;
            if (!buffer) continue;
            if (buffer.length > config.maxMessageBytes) {
              errorCount += 1;
              errors.push(`Skipped oversized message in ${remote.name}`);
              log(`Skipped oversized message UID ${msg.uid} in ${remote.name}`);
              continue;
            }
            folderBytes += buffer.length;
            const contentHash = hashContent(buffer);
            if (messagesRepo.existsByHash(accountId, folder.id, contentHash)) continue;
            let meta;
            try {
              meta = metadataFromFetch(msg);
            } catch (_) {
              meta = await parseMessage(buffer);
            }
            const rawPath = saveRawMessage(accountId, localName, contentHash, buffer);
            const result = messagesRepo.insertMessage({
              account_id: accountId,
              folder_id: folder.id,
              uid: msg.uid,
              message_id: meta.messageId,
              subject: meta.subject,
              from_addr: meta.from,
              to_addr: meta.to,
              cc_addr: meta.cc,
              bcc_addr: meta.bcc,
              date_sent: meta.dateSent,
              size_bytes: meta.sizeBytes || buffer.length,
              flags: JSON.stringify(Array.from(msg.flags || [])),
              raw_path: rawPath,
              content_hash: contentHash,
              has_attachments: meta.hasAttachments || (meta.attachments && meta.attachments.length ? 1 : 0),
            });
            if (result.inserted) {
              messagesRepo.insertBody(result.id, meta);
              for (const att of meta.attachments || []) messagesRepo.insertAttachment(result.id, att);
              newInFolder += 1;
              newMessages += 1;
            }
            totalMessages += 1;
            if (count % 25 === 0) {
              log(`${remote.name}: processed ${count} message(s), ${newInFolder} new`);
              if (jobUpdate) {
                const progress = Math.round((folderIndex / totalFolders) * 100);
                jobUpdate({ progress, result: { folder: remote.name, count, newInFolder, folderBytes } });
              }
            }
          }
          log(`Finished ${remote.name}: ${count} fetched, ${newInFolder} new, ${formatBytes(folderBytes)}`);
          if (jobUpdate) {
            const progress = Math.round((folderIndex / totalFolders) * 100);
            jobUpdate({ progress, result: { folder: remote.name, count, newInFolder, folderBytes } });
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
    log(`Backup complete: ${newMessages} new message(s), ${errorCount} error(s)`);
    return { runId: run.id, totalMessages, newMessages, errorCount };
  } catch (err) {
    log(`Backup failed: ${err.message}`);
    backupRunsRepo.updateRun(run.id, {
      status: jobsRepo.isCancelled(jobId) ? "cancelled" : "failed",
      finished_at: new Date().toISOString(),
      error_count: errorCount + 1,
      error_log: err.message,
    });
    if (!jobsRepo.isCancelled(jobId)) accountsRepo.setAccountStatus(accountId, "error");
    throw err;
  }
}
module.exports = { runBackup };
