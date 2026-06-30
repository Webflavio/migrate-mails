const fs = require("fs");
const path = require("path");
const config = require("../config");
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
function messagePath(accountId, folderLocalName, hash) {
  const dir = path.join(config.storagePath, String(accountId), folderLocalName);
  ensureDir(dir);
  return path.join(dir, `${hash}.eml`);
}
function relativePath(fullPath) {
  return path.relative(config.root, fullPath).split(path.sep).join("/");
}
function saveRawMessage(accountId, folderLocalName, hash, buffer) {
  const full = messagePath(accountId, folderLocalName, hash);
  fs.writeFileSync(full, buffer);
  return relativePath(full);
}
function readRawMessage(relative) {
  return fs.readFileSync(path.join(config.root, relative));
}
function deleteIfExists(filePath) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
function getAccountStorageSize(accountId) {
  const dir = path.join(config.storagePath, String(accountId));
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else total += fs.statSync(full).size;
    }
  }
  walk(dir);
  return total;
}
function getExportSize() {
  if (!fs.existsSync(config.exportPath)) return 0;
  let total = 0;
  for (const file of fs.readdirSync(config.exportPath)) {
    const full = path.join(config.exportPath, file);
    if (fs.statSync(full).isFile()) total += fs.statSync(full).size;
  }
  return total;
}
function getStorageSize() {
  let total = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else total += fs.statSync(full).size;
    }
  }
  walk(config.storagePath);
  return total;
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
module.exports = { ensureDir, messagePath, relativePath, saveRawMessage, readRawMessage, deleteIfExists, getStorageSize, getAccountStorageSize, getExportSize, formatBytes };
