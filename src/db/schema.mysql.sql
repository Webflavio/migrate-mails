CREATE TABLE IF NOT EXISTS accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  imap_host VARCHAR(255) NOT NULL,
  imap_port INT NOT NULL DEFAULT 993,
  imap_secure TINYINT NOT NULL DEFAULT 1,
  username VARCHAR(255) NOT NULL,
  password_enc TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'unknown',
  last_tested_at DATETIME NULL,
  last_backup_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS folders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  remote_name VARCHAR(512) NOT NULL,
  local_name VARCHAR(512) NOT NULL,
  delimiter VARCHAR(8) DEFAULT '/',
  uid_validity BIGINT NULL,
  message_count INT NOT NULL DEFAULT 0,
  included TINYINT NOT NULL DEFAULT 1,
  last_synced_at DATETIME NULL,
  UNIQUE KEY uq_folders_account_remote (account_id, remote_name(255)),
  KEY idx_folders_account (account_id),
  CONSTRAINT fk_folders_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  folder_id INT NOT NULL,
  uid BIGINT NULL,
  message_id VARCHAR(512) NULL,
  subject TEXT NULL,
  from_addr TEXT NULL,
  to_addr TEXT NULL,
  cc_addr TEXT NULL,
  bcc_addr TEXT NULL,
  date_sent DATETIME NULL,
  size_bytes INT NOT NULL DEFAULT 0,
  flags TEXT NULL,
  raw_path TEXT NOT NULL,
  content_hash CHAR(64) NOT NULL,
  has_attachments TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_messages_hash (account_id, folder_id, content_hash),
  KEY idx_messages_account (account_id),
  KEY idx_messages_folder (folder_id),
  KEY idx_messages_date (date_sent),
  KEY idx_messages_subject (subject(191)),
  CONSTRAINT fk_messages_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_folder FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS message_bodies (
  message_id INT PRIMARY KEY,
  text_preview TEXT NULL,
  html_available TINYINT NOT NULL DEFAULT 0,
  search_text TEXT NULL,
  KEY idx_bodies_search (search_text(191)),
  CONSTRAINT fk_bodies_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  filename VARCHAR(512) NOT NULL,
  content_type VARCHAR(255) NULL,
  size_bytes INT NOT NULL DEFAULT 0,
  storage_path TEXT NULL,
  KEY idx_attachments_message (message_id),
  CONSTRAINT fk_attachments_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS backup_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  total_folders INT NOT NULL DEFAULT 0,
  total_messages INT NOT NULL DEFAULT 0,
  new_messages INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  error_log MEDIUMTEXT NULL,
  KEY idx_backup_runs_account (account_id),
  CONSTRAINT fk_backup_runs_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  progress INT NOT NULL DEFAULT 0,
  input_json MEDIUMTEXT NULL,
  output_path TEXT NULL,
  result_json MEDIUMTEXT NULL,
  error_text TEXT NULL,
  log_text MEDIUMTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  KEY idx_jobs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_account_id INT NOT NULL,
  target_account_id INT NOT NULL,
  folder_mapping_json MEDIUMTEXT NOT NULL,
  duplicate_strategy VARCHAR(32) NOT NULL DEFAULT 'message_id',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  total_messages INT NOT NULL DEFAULT 0,
  migrated_messages INT NOT NULL DEFAULT 0,
  skipped_messages INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  job_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  KEY idx_migrations_source (source_account_id),
  KEY idx_migrations_target (target_account_id),
  CONSTRAINT fk_migrations_source FOREIGN KEY (source_account_id) REFERENCES accounts(id),
  CONSTRAINT fk_migrations_target FOREIGN KEY (target_account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(64) PRIMARY KEY,
  setting_value TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
