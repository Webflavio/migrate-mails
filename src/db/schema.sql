PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL DEFAULT 993,
  imap_secure INTEGER NOT NULL DEFAULT 1,
  username TEXT NOT NULL,
  password_enc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_tested_at TEXT,
  last_backup_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  remote_name TEXT NOT NULL,
  local_name TEXT NOT NULL,
  delimiter TEXT DEFAULT '/',
  uid_validity INTEGER,
  message_count INTEGER NOT NULL DEFAULT 0,
  included INTEGER NOT NULL DEFAULT 1,
  last_synced_at TEXT,
  UNIQUE(account_id, remote_name)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  uid INTEGER,
  message_id TEXT,
  subject TEXT,
  from_addr TEXT,
  to_addr TEXT,
  cc_addr TEXT,
  bcc_addr TEXT,
  date_sent TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  flags TEXT,
  raw_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  has_attachments INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, folder_id, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_messages_account ON messages(account_id);
CREATE INDEX IF NOT EXISTS idx_messages_folder ON messages(folder_id);
CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(date_sent);
CREATE INDEX IF NOT EXISTS idx_messages_subject ON messages(subject);
CREATE TABLE IF NOT EXISTS message_bodies (
  message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  text_preview TEXT,
  html_available INTEGER NOT NULL DEFAULT 0,
  search_text TEXT
);
CREATE INDEX IF NOT EXISTS idx_bodies_search ON message_bodies(search_text);
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT
);
CREATE TABLE IF NOT EXISTS backup_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  total_folders INTEGER NOT NULL DEFAULT 0,
  total_messages INTEGER NOT NULL DEFAULT 0,
  new_messages INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  error_log TEXT
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  input_json TEXT,
  output_path TEXT,
  result_json TEXT,
  error_text TEXT,
  log_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT
);
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_account_id INTEGER NOT NULL REFERENCES accounts(id),
  target_account_id INTEGER NOT NULL REFERENCES accounts(id),
  folder_mapping_json TEXT NOT NULL,
  duplicate_strategy TEXT NOT NULL DEFAULT 'message_id',
  status TEXT NOT NULL DEFAULT 'pending',
  total_messages INTEGER NOT NULL DEFAULT 0,
  migrated_messages INTEGER NOT NULL DEFAULT 0,
  skipped_messages INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  job_id INTEGER REFERENCES jobs(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
