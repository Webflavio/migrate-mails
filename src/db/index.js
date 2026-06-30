const fs = require("fs");
const path = require("path");
const util = require("util");
const mysql = require("mysql");
const config = require("../config");
const { runMigrations } = require("./migrate");
const schema = fs.readFileSync(path.join(__dirname, "schema.mysql.sql"), "utf8");
const state = global.__mailvaultDbState || { pool: null };
global.__mailvaultDbState = state;
function wrapPool(pool) {
  pool.queryAsync = util.promisify(pool.query.bind(pool));
  pool.getConnectionAsync = util.promisify(pool.getConnection.bind(pool));
  return pool;
}
function resolveMysqlHost(host) {
  if (config.isHosted && (host === "127.0.0.1" || host === "::1")) return "localhost";
  return host;
}
function buildPoolOptions(mysqlConfig) {
  const opts = {
    host: resolveMysqlHost(mysqlConfig.host),
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
  return opts;
}
function formatDbError(err, mysqlConfig) {
  const host = resolveMysqlHost(mysqlConfig.host);
  if (err.code === "ER_ACCESS_DENIED_ERROR") {
    return new Error(
      `MySQL login failed for user '${mysqlConfig.user}'@${host}. ` +
      "The password or username is wrong, or the user is not linked to the database. " +
      "In hPanel → Databases → Management: reset the MySQL user password, confirm MYSQL_USER is the username (not only the database name), " +
      "assign the user to MYSQL_DATABASE with All Privileges, then update MYSQL_PASSWORD in Node.js env vars and redeploy."
    );
  }
  if (err.code === "ER_BAD_DB_ERROR") {
    return new Error(
      `MySQL database '${mysqlConfig.database}' does not exist. Create it in hPanel → Databases → MySQL first.`
    );
  }
  if (err.code === "ECONNREFUSED") {
    return new Error(
      `Could not connect to MySQL at ${host}:${mysqlConfig.port}. Check MYSQL_HOST and MYSQL_PORT in your environment variables.`
    );
  }
  return err;
}
function getPool() {
  if (state.pool) return state.pool;
  throw new Error("Database not initialized. Call initDb() first.");
}
async function query(sql, params) {
  const rows = await getPool().queryAsync(sql, params);
  return rows;
}
async function queryOne(sql, params) {
  const rows = await query(sql, params);
  return rows[0];
}
async function execute(sql, params) {
  const result = await getPool().queryAsync(sql, params);
  return { lastInsertRowid: Number(result.insertId), changes: result.affectedRows };
}
function connQuery(conn) {
  const queryAsync = util.promisify(conn.query.bind(conn));
  return {
    query: queryAsync,
    queryOne: async (sql, params) => {
      const rows = await queryAsync(sql, params);
      return rows[0];
    },
    execute: async (sql, params) => {
      const result = await queryAsync(sql, params);
      return { lastInsertRowid: Number(result.insertId), changes: result.affectedRows };
    },
  };
}
async function transaction(fn) {
  const conn = await getPool().getConnectionAsync();
  try {
    await util.promisify(conn.beginTransaction.bind(conn))();
    const result = await fn(connQuery(conn));
    await util.promisify(conn.commit.bind(conn))();
    return result;
  } catch (err) {
    await util.promisify(conn.rollback.bind(conn))();
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
  const hostsToTry = [];
  const primaryHost = resolveMysqlHost(mysqlConfig.host);
  hostsToTry.push(primaryHost);
  if (primaryHost !== "localhost" && mysqlConfig.host !== "localhost") hostsToTry.push("localhost");
  let lastError;
  for (const host of hostsToTry) {
    if (state.pool) {
      await util.promisify(state.pool.end.bind(state.pool))();
      state.pool = null;
    }
    state.pool = wrapPool(mysql.createPool(buildPoolOptions({ ...mysqlConfig, host })));
    try {
      await bootstrapSchema();
      return state.pool;
    } catch (err) {
      lastError = err;
      await util.promisify(state.pool.end.bind(state.pool))();
      state.pool = null;
      if (err.code !== "ER_ACCESS_DENIED_ERROR" && err.code !== "ECONNREFUSED") break;
    }
  }
  throw formatDbError(lastError, mysqlConfig);
}
async function closeDb() {
  if (state.pool) {
    await util.promisify(state.pool.end.bind(state.pool))();
    state.pool = null;
  }
}
module.exports = { getPool, initDb, closeDb, query, queryOne, execute, transaction };
