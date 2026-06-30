const fs = require("fs");
const path = require("path");
const config = require("../config");
function ensureAppDirs() {
  const dirs = [config.storagePath, config.exportPath];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
module.exports = { ensureAppDirs };
