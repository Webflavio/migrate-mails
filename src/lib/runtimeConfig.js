const config = require("../config");
const settingsRepo = require("../repos/settings");
function getRuntimeSettings() {
  const s = settingsRepo.getAllSettings();
  const maxMb = Number(s.max_message_mb) || config.maxMessageBytes / 1024 / 1024;
  return {
    maxMessageBytes: maxMb * 1024 * 1024,
    exportRetentionDays: Number(s.export_retention_days) || config.exportRetentionDays,
    jobConcurrency: Number(s.job_concurrency) || config.jobConcurrency,
    imapTimeoutMs: Number(s.imap_timeout_ms) || config.imapTimeoutMs,
    backupRunRetentionDays: Number(s.backup_run_retention_days) || 90,
    jobRetentionDays: Number(s.job_retention_days) || 30,
  };
}
module.exports = { getRuntimeSettings };
