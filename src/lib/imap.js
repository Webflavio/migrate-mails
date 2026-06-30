const { ImapFlow } = require("imapflow");
const config = require("../config");
function createClient(account, password) {
  return new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_secure === 1,
    auth: { user: account.username, pass: password },
    logger: false,
    socketTimeout: config.imapTimeoutMs,
    greetingTimeout: config.imapTimeoutMs,
  });
}
async function withClient(account, password, fn) {
  const client = createClient(account, password);
  try {
    await client.connect();
    return await fn(client);
  } finally {
    try { await client.logout(); } catch (_) {}
  }
}
async function testConnection(account, password) {
  return withClient(account, password, async (client) => {
    const folders = [];
    for await (const box of client.list()) {
      folders.push({ name: box.path, delimiter: box.delimiter || "/" });
    }
    return { ok: true, folderCount: folders.length, folders: folders.slice(0, 20) };
  });
}
async function listFolders(account, password) {
  return withClient(account, password, async (client) => {
    const folders = [];
    for await (const box of client.list()) {
      folders.push({ name: box.path, delimiter: box.delimiter || "/", flags: box.flags });
    }
    return folders;
  });
}
async function ensureFolder(client, name, delimiter) {
  if (name.toUpperCase() === "INBOX") return;
  const lock = await client.getMailboxLock(name).catch(() => null);
  if (lock) {
    lock.release();
    return;
  }
  if (delimiter && name.includes(delimiter)) {
    const parts = name.split(delimiter);
    let current = parts[0];
    for (const part of parts.slice(1)) {
      current = `${current}${delimiter}${part}`;
      if (current.toUpperCase() !== "INBOX") {
        try { await client.mailboxCreate(current); } catch (_) {}
      }
    }
  } else {
    try { await client.mailboxCreate(name); } catch (_) {}
  }
}
function mapFolderName(name, sourceDelimiter, targetDelimiter) {
  if (sourceDelimiter && targetDelimiter && sourceDelimiter !== targetDelimiter) {
    return name.split(sourceDelimiter).join(targetDelimiter);
  }
  return name;
}
module.exports = { createClient, withClient, testConnection, listFolders, ensureFolder, mapFolderName };
