function cleanEnv(value) {
  if (value === undefined || value === null) return value;
  let text = String(value).trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1);
  }
  return text;
}
function normalizeMysqlConfig(mysql, isHosted) {
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
  if (!mysql.user) issues.push("MYSQL_USER is missing");
  if (!mysql.database) issues.push("MYSQL_DATABASE is missing");
  if (!mysql.password) issues.push("MYSQL_PASSWORD is missing or empty");
  if (issues.length) {
    const where = isHosted ? "hPanel → Websites → Node.js → Environment variables" : "your .env file";
    throw new Error(`MySQL configuration incomplete: ${issues.join(", ")}. Set them in ${where}.`);
  }
}
function mysqlStartupHint(mysql, isHosted) {
  return `[startup] MySQL password: ${mysql.password ? `set (${mysql.password.length} chars)` : "MISSING"} · user: ${mysql.user} · database: ${mysql.database}`;
}
module.exports = { cleanEnv, normalizeMysqlConfig, validateMysqlConfig, mysqlStartupHint };
