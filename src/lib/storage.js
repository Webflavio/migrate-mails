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
module.exports = { ensureDir, messagePath, relativePath, saveRawMessage, readRawMessage, deleteIfExists, getStorageSize, formatBytes };
