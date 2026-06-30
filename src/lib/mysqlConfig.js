function cleanEnv(value) {
  if (value === undefined || value === null) return value;
  let text = String(value).trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1);
  }
  return text;
}
function parseMysqlUrl(rawUrl) {
  const urlText = cleanEnv(rawUrl);
  if (!urlText) throw new Error("MYSQL_URL is required. Example: mysql://user:password@localhost:3306/mailvault");
  let parsed;
  try {
    parsed = new URL(urlText);
  } catch (_) {
    throw new Error("MYSQL_URL is invalid. Use mysql://user:password@localhost:3306/database");
  }
  if (parsed.protocol !== "mysql:") {
    throw new Error("MYSQL_URL must use the mysql:// scheme");
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!database) {
    throw new Error("MYSQL_URL must include a database name, e.g. mysql://user:pass@localhost:3306/mailvault");
  }
  let host = parsed.hostname || "localhost";
  if (host === "127.0.0.1" || host === "::1") host = "localhost";
  return {
    host,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username || ""),
    password: decodeURIComponent(parsed.password || ""),
    database,
    socketPath: undefined,
  };
}
function normalizeMysqlConfig(mysql) {
  return {
    host: cleanEnv(mysql.host) || "localhost",
    port: Number(mysql.port) || 3306,
    user: cleanEnv(mysql.user) || "",
    password: cleanEnv(mysql.password) || "",
    database: cleanEnv(mysql.database) || "",
    socketPath: cleanEnv(mysql.socketPath) || undefined,
  };
}
function validateMysqlConfig(mysql, isHosted) {
  if (!isHosted) return;
  const issues = [];
  if (!mysql.user) issues.push("MYSQL_URL is missing the username");
  if (!mysql.database) issues.push("MYSQL_URL is missing the database name");
  if (!mysql.password) issues.push("MYSQL_URL is missing the password");
  if (issues.length) {
    const where = "hPanel → Websites → Node.js → Environment variables";
    throw new Error(`MySQL configuration incomplete: ${issues.join(", ")}. Set MYSQL_URL in ${where}.`);
  }
}
function redactMysqlUrl(rawUrl) {
  try {
    const parsed = new URL(cleanEnv(rawUrl));
    if (parsed.password) parsed.password = "***";
    if (parsed.username) parsed.username = parsed.username.replace(/.+/g, (value) => (value.length > 2 ? `${value.slice(0, 2)}***` : "***"));
    return parsed.toString();
  } catch (_) {
    return "mysql://***";
  }
}
function mysqlStartupHint(mysql) {
  return `[startup] MySQL password: ${mysql.password ? `set (${mysql.password.length} chars)` : "MISSING"} · user: ${mysql.user} · database: ${mysql.database}`;
}
module.exports = { cleanEnv, parseMysqlUrl, normalizeMysqlConfig, validateMysqlConfig, redactMysqlUrl, mysqlStartupHint };
