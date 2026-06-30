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
async function initDb() {
  if (state.pool) return state.pool;
  state.pool = wrapPool(mysql.createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
    timezone: "Z",
    multipleStatements: true,
  }));
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
  return state.pool;
}
async function closeDb() {
  if (state.pool) {
    await util.promisify(state.pool.end.bind(state.pool))();
    state.pool = null;
  }
}
module.exports = { getPool, initDb, closeDb, query, queryOne, execute, transaction };
