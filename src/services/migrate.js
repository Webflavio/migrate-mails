const { withClient, ensureFolder, mapFolderName, listMailboxes } = require("../lib/imap");
const { readRawMessage } = require("../lib/storage");
const accountsRepo = require("../repos/accounts");
const foldersRepo = require("../repos/folders");
const messagesRepo = require("../repos/messages");
const migrationsRepo = require("../repos/migrations");
async function runMigration(migrationId, jobUpdate) {
  const migration = migrationsRepo.getMigration(migrationId);
  if (!migration) throw new Error("Migration not found");
  const sourceAccount = accountsRepo.getAccount(migration.source_account_id);
  const targetAccount = accountsRepo.getAccount(migration.target_account_id);
  const targetPassword = accountsRepo.getPassword(targetAccount);
  const folderMapping = migration.folder_mapping || {};
  const sourceFolders = foldersRepo.listFolders(migration.source_account_id);
  let total = 0;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  migrationsRepo.updateMigration(migrationId, { status: "running" });
  for (const folder of sourceFolders) {
    const messages = messagesRepo.listByFolder(folder.id, 100000, 0);
    total += messages.length;
  }
  migrationsRepo.updateMigration(migrationId, { total_messages: total });
  await withClient(targetAccount, targetPassword, async (client) => {
    let targetDelimiter = "/";
    const boxes = await listMailboxes(client);
    for (const box of boxes) {
      if (box.delimiter) { targetDelimiter = box.delimiter; break; }
    }
    let processed = 0;
    for (const folder of sourceFolders) {
      const targetFolderName = folderMapping[folder.remote_name] || mapFolderName(folder.remote_name, folder.delimiter, targetDelimiter);
      await ensureFolder(client, targetFolderName, targetDelimiter);
      const messages = messagesRepo.listByFolder(folder.id, 100000, 0);
      for (const msg of messages) {
        processed += 1;
        try {
          if (migration.duplicate_strategy === "message_id" && msg.message_id) {
            const lock = await client.getMailboxLock(targetFolderName);
            try {
              const existing = await client.search({ header: { "Message-ID": msg.message_id } }, { uid: true });
              if (existing && existing.length) {
                skipped += 1;
                continue;
              }
            } finally {
              lock.release();
            }
          }
          const raw = readRawMessage(msg.raw_path);
          await client.append(targetFolderName, raw, ["\\Seen"]);
          migrated += 1;
        } catch (err) {
          errors += 1;
        }
        if (jobUpdate && processed % 5 === 0) {
          jobUpdate({
            progress: total ? Math.round((processed / total) * 100) : 100,
            result: { migrated, skipped, errors },
          });
          migrationsRepo.updateMigration(migrationId, { migrated_messages: migrated, skipped_messages: skipped, error_count: errors });
        }
      }
    }
  });
  migrationsRepo.updateMigration(migrationId, {
    status: errors ? "completed_with_errors" : "completed",
    migrated_messages: migrated,
    skipped_messages: skipped,
    error_count: errors,
    finished_at: new Date().toISOString(),
  });
  if (jobUpdate) jobUpdate({ progress: 100, result: { migrated, skipped, errors } });
  return { total, migrated, skipped, errors };
}
module.exports = { runMigration };
