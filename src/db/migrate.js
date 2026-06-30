function runMigrations(db) {
  const jobCols = db.prepare("PRAGMA table_info(jobs)").all();
  if (!jobCols.some((col) => col.name === "log_text")) {
    db.exec("ALTER TABLE jobs ADD COLUMN log_text TEXT NOT NULL DEFAULT ''");
  }
}
module.exports = { runMigrations };
