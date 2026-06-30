const config = require("../config");
const settingsRepo = require("../repos/settings");
let cache = null;
let cacheTime = 0;
const CACHE_MS = 30000;
function defaultsFromConfig() {
  return {
    maxMessageBytes: config.maxMessageBytes,
    exportRetentionDays: config.exportRetentionDays,
    jobConcurrency: config.jobConcurrency,
    imapTimeoutMs: config.imapTimeoutMs,
    backupRunRetentionDays: 90,
    jobRetentionDays: 30,
  };
}
async function getRuntimeSettings() {
  if (cache && Date.now() - cacheTime < CACHE_MS) return cache;
  const s = await settingsRepo.getAllSettings();
  cache = {
    maxMessageBytes: (Number(s.max_message_mb) || config.maxMessageBytes / 1024 / 1024) * 1024 * 1024,
    exportRetentionDays: Number(s.export_retention_days) || config.exportRetentionDays,
    jobConcurrency: Number(s.job_concurrency) || config.jobConcurrency,
    imapTimeoutMs: Number(s.imap_timeout_ms) || config.imapTimeoutMs,
    backupRunRetentionDays: Number(s.backup_run_retention_days) || 90,
    jobRetentionDays: Number(s.job_retention_days) || 30,
  };
  cacheTime = Date.now();
  return cache;
}
function getRuntimeSettingsSync() {
  return cache || defaultsFromConfig();
}
function clearRuntimeSettingsCache() {
  cache = null;
  cacheTime = 0;
}
module.exports = { getRuntimeSettings, getRuntimeSettingsSync, clearRuntimeSettingsCache };
