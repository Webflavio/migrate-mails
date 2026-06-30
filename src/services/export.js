const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const config = require("../config");
const { getRuntimeSettingsSync } = require("../lib/runtimeConfig");
const { readRawMessage } = require("../lib/storage");
const messagesRepo = require("../repos/messages");
function ensureExportDir() {
  fs.mkdirSync(config.exportPath, { recursive: true });
}
function safeFileName(value) {
  return String(value || "message").replace(/[<>:"/\\|?*\x00-\x1f]+/g, "_").slice(0, 120);
}
async function exportEmlZip(accountId, options, jobUpdate) {
  ensureExportDir();
  const messages = await messagesRepo.listForExport(accountId, options.folderIds, options.messageIds);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(config.exportPath, `export-${accountId}-${timestamp}.zip`);
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    let index = 0;
    for (const msg of messages) {
      index += 1;
      const buffer = readRawMessage(msg.raw_path);
      const name = `${safeFileName(msg.subject || "message")}_${msg.id}.eml`;
      archive.append(buffer, { name });
      if (jobUpdate && index % 10 === 0) {
        jobUpdate({ progress: Math.round((index / messages.length) * 100) });
      }
    }
    archive.finalize();
  });
  if (jobUpdate) jobUpdate({ progress: 100 });
  return { outputPath, count: messages.length, format: "eml-zip" };
}
async function exportMbox(accountId, options, jobUpdate) {
  ensureExportDir();
  const messages = await messagesRepo.listForExport(accountId, options.folderIds, options.messageIds);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(config.exportPath, `export-${accountId}-${timestamp}.mbox`);
  const stream = fs.createWriteStream(outputPath, { flags: "w" });
  let index = 0;
  for (const msg of messages) {
    index += 1;
    const buffer = readRawMessage(msg.raw_path);
    stream.write(`From ${msg.from_addr || "unknown"} ${msg.date_sent || new Date().toISOString()}\n`);
    stream.write(buffer);
    if (!buffer.toString().endsWith("\n")) stream.write("\n");
    stream.write("\n");
    if (jobUpdate && index % 10 === 0) {
      jobUpdate({ progress: Math.round((index / messages.length) * 100) });
    }
  }
  await new Promise((resolve, reject) => {
    stream.end(resolve);
    stream.on("error", reject);
  });
  if (jobUpdate) jobUpdate({ progress: 100 });
  return { outputPath, count: messages.length, format: "mbox" };
}
function cleanupOldExports() {
  ensureExportDir();
  const maxAge = getRuntimeSettingsSync().exportRetentionDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  for (const file of fs.readdirSync(config.exportPath)) {
    const full = path.join(config.exportPath, file);
    const stat = fs.statSync(full);
    if (now - stat.mtimeMs > maxAge) fs.unlinkSync(full);
  }
}
module.exports = { exportEmlZip, exportMbox, cleanupOldExports };
