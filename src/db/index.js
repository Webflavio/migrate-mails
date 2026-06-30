const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const config = require("../config");
const { runMigrations } = require("./migrate");
const schema = fs.readFileSync(path.join(__dirname, "schema.mysql.sql"), "utf8");
const state = global.__mailvaultDbState || { pool: null };
global.__mailvaultDbState = state;
function isLocalMysqlHost(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}
function resolveMysqlHost(host) {
  if (config.isHosted && (host === "127.0.0.1" || host === "::1")) return "localhost";
  return host;
}
function buildPoolOptions(mysqlConfig) {
  const host = resolveMysqlHost(mysqlConfig.host);
  const opts = {
    host,
    port: mysqlConfig.port,
    user: mysqlConfig.user,
    password: mysqlConfig.password,
    database: mysqlConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
    timezone: "Z",
    multipleStatements: true,
  };
  if (mysqlConfig.socketPath) opts.socketPath = mysqlConfig.socketPath;
  if (!isLocalMysqlHost(host)) opts.ssl = { rejectUnauthorized: false };
  return opts;
}
function formatDbError(err, mysqlConfig) {
  const host = resolveMysqlHost(mysqlConfig.host);
  if (err.code === "ER_ACCESS_DENIED_ERROR") {
    return new Error(
      `MySQL login failed for user '${mysqlConfig.user}'@${host}. ` +
      "The password or username is wrong, or the user is not linked to the database. " +
      "In hPanel → Databases → Management: reset the MySQL user password, confirm the username in MYSQL_URL is correct, " +
      "assign that user to the database with All Privileges, then update MYSQL_URL in Node.js env vars and redeploy."
    );
  }
  if (err.code === "ER_BAD_DB_ERROR") {
    return new Error(
      `MySQL database '${mysqlConfig.database}' does not exist. Create it in hPanel → Databases → MySQL first.`
    );
  }
  if (err.code === "ECONNREFUSED") {
    return new Error(
      `Could not connect to MySQL at ${host}:${mysqlConfig.port}. Check the host and port in MYSQL_URL.`
    );
  }
  if (err.code === "ER_NOT_SUPPORTED_AUTH_MODE") {
    return new Error(
      "MySQL server requires a modern authentication plugin (MySQL 8+). Update the app to the latest version with mysql2 support."
    );
  }
  return err;
}
function getPool() {
  if (state.pool) return state.pool;
  throw new Error("Database not initialized. Call initDb() first.");
}
async function query(sql, params) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}
async function queryOne(sql, params) {
  const rows = await query(sql, params);
  return rows[0];
}
async function execute(sql, params) {
  const [result] = await getPool().query(sql, params);
  return { lastInsertRowid: Number(result.insertId), changes: result.affectedRows };
}
function connQuery(conn) {
  return {
    query: async (sql, params) => {
      const [rows] = await conn.query(sql, params);
      return rows;
    },
    queryOne: async (sql, params) => {
      const rows = await connQuery(conn).query(sql, params);
      return rows[0];
    },
    execute: async (sql, params) => {
      const [result] = await conn.query(sql, params);
      return { lastInsertRowid: Number(result.insertId), changes: result.affectedRows };
    },
  };
}
async function transaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(connQuery(conn));
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
async function bootstrapSchema() {
  const statements = schema.split(/;\s*\n/).map((part) => part.trim()).filter(Boolean);
  for (const stmt of statements) await query(stmt);
  await runMigrations(query);
  const defaults = [
    ["storage_path", config.storagePath],
    ["export_path", config.exportPath],
    ["export_retention_days", String(config.exportRetentionDays)],
    ["max_message_mb", String(config.maxMessageBytes / 1024 / 1024)],
  ];
  for (const [key, value] of defaults) {
    await execute(
      "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_key = setting_key",
      [key, value]
    );
  }
}
async function initDb() {
  if (state.pool) return state.pool;
  const mysqlConfig = config.mysql;
  const primaryHost = resolveMysqlHost(mysqlConfig.host);
  const hostsToTry = [primaryHost];
  if (primaryHost === "127.0.0.1" || primaryHost === "::1") hostsToTry.push("localhost");
  let lastError;
  for (const host of hostsToTry) {
    if (state.pool) {
      await state.pool.end();
      state.pool = null;
    }
    state.pool = mysql.createPool(buildPoolOptions({ ...mysqlConfig, host }));
    try {
      await bootstrapSchema();
      return state.pool;
    } catch (err) {
      lastError = err;
      await state.pool.end();
      state.pool = null;
      if (err.code !== "ER_ACCESS_DENIED_ERROR" && err.code !== "ECONNREFUSED") break;
    }
  }
  throw formatDbError(lastError, mysqlConfig);
}
async function closeDb() {
  if (state.pool) {
    await state.pool.end();
    state.pool = null;
  }
}
module.exports = { getPool, initDb, closeDb, query, queryOne, execute, transaction };
