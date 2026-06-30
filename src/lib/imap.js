const { ImapFlow } = require("imapflow");
const config = require("../config");
function buildTlsOptions(account) {
  const tls = { servername: account.imap_host };
  if (config.imapTlsInsecure) tls.rejectUnauthorized = false;
  return tls;
}
function createClient(account, password) {
  return new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_secure === 1,
    auth: { user: account.username, pass: password },
    logger: false,
    socketTimeout: config.imapTimeoutMs,
    greetingTimeout: config.imapTimeoutMs,
    connectionTimeout: config.imapTimeoutMs,
    tls: buildTlsOptions(account),
  });
}
function formatImapError(err) {
  if (!err) return "Unknown IMAP error";
  if (err.responseText) return `${err.message || "IMAP error"}: ${err.responseText}`;
  if (err.code === "ECONNREFUSED") return `Connection refused to ${err.address || "server"}${err.port ? `:${err.port}` : ""}`;
  if (err.code === "ETIMEDOUT" || err.code === "ESOCKET") return "Connection timed out. Check host, port, TLS setting, and whether outbound IMAP is allowed on this server.";
  if (err.code === "ENOTFOUND") return "Host not found. Verify the IMAP hostname.";
  if (err.code === "ECONNRESET") return "Connection reset by server. Try toggling Secure (TLS) or port 993 vs 143.";
  if (err.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || err.code === "CERT_HAS_EXPIRED" || /certificate/i.test(err.message || "")) {
    return `TLS certificate error: ${err.message}. Set IMAP_TLS_INSECURE=true in .env if your provider uses a self-signed certificate.`;
  }
  if (/authentication/i.test(err.message || "") || err.authenticationFailed) return `Authentication failed: ${err.message || "check username and password"}`;
  return err.message || String(err);
}
async function withClient(account, password, fn) {
  const client = createClient(account, password);
  try {
    await client.connect();
    return await fn(client);
  } catch (err) {
    throw new Error(formatImapError(err));
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
module.exports = { createClient, withClient, testConnection, listFolders, ensureFolder, mapFolderName, formatImapError };
