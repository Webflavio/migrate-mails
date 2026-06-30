function parseBool(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (value === true || value === 1 || value === "1" || value === "true" || value === "on") return true;
  if (value === false || value === 0 || value === "0" || value === "false" || value === "off") return false;
  return defaultValue;
}
module.exports = { parseBool };
