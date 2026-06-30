function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
module.exports = { formatBytes };
