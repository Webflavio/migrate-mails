const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");
const config = require("../config");
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
let sqlDb;
let SQL;
class Statement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
  }
  run(...args) {
    if (args.length === 1 && args[0] && typeof args[0] === "object" && !Array.isArray(args[0])) {
      const bound = {};
      for (const [key, value] of Object.entries(args[0])) {
        bound[key.startsWith("@") || key.startsWith("$") || key.startsWith(":") ? key : `@${key}`] = value;
      }
      this.db.run(this.sql, bound);
    } else if (args.length === 1 && Array.isArray(args[0])) {
      this.db.run(this.sql, args[0]);
    } else if (args.length) {
      this.db.run(this.sql, args);
    } else {
      this.db.run(this.sql);
    }
    const idRow = this.db.exec("SELECT last_insert_rowid()");
    const lastInsertRowid = idRow.length ? idRow[0].values[0][0] : 0;
    const changes = this.db.getRowsModified();
    persist();
    return { lastInsertRowid, changes };
  }
  get(...params) {
    const stmt = this.db.prepare(this.sql);
    if (params.length) stmt.bind(params);
    let row;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  all(...params) {
    const stmt = this.db.prepare(this.sql);
    if (params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }
}
function wrapDb(db) {
  return {
    pragma(value) {
      db.run(`PRAGMA ${value}`);
    },
    exec(sql) {
      db.exec(sql);
      persist();
    },
    prepare(sql) {
      return new Statement(db, sql);
    },
  };
}
function persist() {
  if (!sqlDb) return;
  const data = sqlDb.export();
  fs.writeFileSync(config.dbPath, Buffer.from(data));
}
function getDb() {
  if (sqlDb) return wrapDb(sqlDb);
  throw new Error("Database not initialized. Call initDb() first.");
}
async function initDb() {
  if (sqlDb) return wrapDb(sqlDb);
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const sqlDist = path.dirname(require.resolve("sql.js/dist/sql-wasm.js"));
  SQL = await initSqlJs({
    locateFile: (file) => path.join(sqlDist, file),
  });
  if (fs.existsSync(config.dbPath)) {
    const fileBuffer = fs.readFileSync(config.dbPath);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }
  const db = wrapDb(sqlDb);
  db.exec(schema);
  const defaults = [
    ["storage_path", config.storagePath],
    ["export_path", config.exportPath],
    ["export_retention_days", String(config.exportRetentionDays)],
    ["max_message_mb", String(config.maxMessageBytes / 1024 / 1024)],
  ];
  const upsert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING");
  for (const row of defaults) upsert.run(row);
  persist();
  return db;
}
function closeDb() {
  if (sqlDb) {
    persist();
    sqlDb.close();
    sqlDb = null;
  }
}
module.exports = { getDb, initDb, closeDb };
