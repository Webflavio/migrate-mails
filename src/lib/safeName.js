function safeName(value) {
  const name = String(value || "").replace(/[<>:"/\\|?*\x00-\x1f]+/g, "_").replace(/^[\s.]+|[\s.]+$/g, "");
  return name || "INBOX";
}
function uniqueName(value, used) {
  let base = safeName(value);
  let name = base;
  let index = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base}_${index}`;
    index += 1;
  }
  used.add(name.toLowerCase());
  return name;
}
module.exports = { safeName, uniqueName };
