const path = require("path");
function resolveDataPath({ root, dataRoot, setting, defaultRel, leaf }) {
  const rootPath = path.resolve(root);
  const raw = setting || defaultRel;
  if (path.isAbsolute(raw)) return raw;
  const resolved = path.resolve(rootPath, raw);
  const insideDeploy = resolved === rootPath || resolved.startsWith(rootPath + path.sep);
  const useDataRoot = dataRoot && insideDeploy && (!setting || setting === defaultRel || setting.startsWith("./data") || setting.startsWith("./storage") || setting.startsWith("./exports"));
  if (useDataRoot) return path.join(dataRoot, leaf);
  return resolved;
}
module.exports = { resolveDataPath };
