async function runMigrations(query) {
  const jobCols = await query("SHOW COLUMNS FROM jobs LIKE 'log_text'");
  if (!jobCols.length) {
    await query("ALTER TABLE jobs ADD COLUMN log_text MEDIUMTEXT NOT NULL");
  }
}
module.exports = { runMigrations };
