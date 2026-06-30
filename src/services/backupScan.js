const { withClient, listMailboxes } = require("../lib/imap");
const { formatBytes } = require("../lib/formatBytes");
const accountsRepo = require("../repos/accounts");
const foldersRepo = require("../repos/folders");
async function scanFolderStats(client, remoteName) {
  const lock = await client.getMailboxLock(remoteName);
  try {
    const status = await client.status(remoteName, { messages: true, uidNext: true, uidValidity: true });
    let totalSize = 0;
    const messages = status.messages || 0;
    if (messages > 0) {
      for await (const msg of client.fetch("1:*", { uid: true, size: true })) {
        totalSize += msg.size || 0;
      }
    }
    return { messages, totalSize };
  } finally {
    lock.release();
  }
}
async function scanAccountFolders(accountId, options) {
  const account = accountsRepo.getAccount(accountId);
  if (!account) throw new Error("Account not found");
  const password = accountsRepo.getPassword(account);
  const includeSizes = options && options.includeSizes;
  const folderNames = options && options.folderNames;
  return withClient(account, password, async (client) => {
    const boxes = await listMailboxes(client);
    let folders = boxes.map((box) => {
      const existing = foldersRepo.listFolders(accountId).find((f) => f.remote_name === box.path);
      return {
        name: box.path,
        delimiter: box.delimiter || "/",
        included: existing ? existing.included === 1 : true,
        backedUp: foldersRepo.getBackedUpCount(accountId, box.path),
        messages: 0,
        totalSize: 0,
      };
    });
    if (folderNames && folderNames.length) {
      folders = folders.filter((f) => folderNames.includes(f.name));
    }
    let totalMessages = 0;
    let totalSize = 0;
    for (const folder of folders) {
      const lock = await client.getMailboxLock(folder.name);
      try {
        const status = await client.status(folder.name, { messages: true });
        folder.messages = status.messages || 0;
        totalMessages += folder.messages;
        if (includeSizes && folder.messages > 0) {
          let folderSize = 0;
          for await (const msg of client.fetch("1:*", { uid: true, size: true })) {
            folderSize += msg.size || 0;
          }
          folder.totalSize = folderSize;
          totalSize += folderSize;
        }
      } finally {
        lock.release();
      }
    }
    return {
      accountId,
      folders,
      totalMessages,
      totalSize,
      totalSizeLabel: formatBytes(totalSize),
      sized: Boolean(includeSizes),
    };
  });
}
module.exports = { scanAccountFolders, scanFolderStats };
