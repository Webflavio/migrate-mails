const express = require("express");
const config = require("../config");
const settingsRepo = require("../repos/settings");
const jobsRepo = require("../repos/jobs");
const { getRuntimeSettings } = require("../lib/runtimeConfig");
const { getStorageSize, getExportSize, formatBytes } = require("../lib/storage");
const exportService = require("../services/export");
const maintenance = require("../services/maintenance");
const router = express.Router();
router.get("/", (req, res) => {
  const settings = settingsRepo.getAllSettings();
  const runtime = getRuntimeSettings();
  res.render("pages/settings/index", {
    title: "Settings",
    settings,
    config,
    runtime,
    storageSize: formatBytes(getStorageSize()),
    exportSize: formatBytes(getExportSize()),
    jobCount: jobsRepo.listJobs(1000).length,
    saved: req.query.saved === "1",
    notice: req.query.notice || null,
    error: req.query.error || null,
  });
});
router.post("/", (req, res) => {
  if (req.body.export_retention_days) settingsRepo.setSetting("export_retention_days", String(req.body.export_retention_days));
  if (req.body.max_message_mb) settingsRepo.setSetting("max_message_mb", String(req.body.max_message_mb));
  if (req.body.job_concurrency) settingsRepo.setSetting("job_concurrency", String(req.body.job_concurrency));
  if (req.body.imap_timeout_ms) settingsRepo.setSetting("imap_timeout_ms", String(req.body.imap_timeout_ms));
  if (req.body.backup_run_retention_days) settingsRepo.setSetting("backup_run_retention_days", String(req.body.backup_run_retention_days));
  if (req.body.job_retention_days) settingsRepo.setSetting("job_retention_days", String(req.body.job_retention_days));
  exportService.cleanupOldExports();
  res.redirect("/settings?saved=1");
});
router.post("/maintenance/clear-exports", (req, res) => {
  try {
    const result = maintenance.clearAllExports();
    res.redirect(`/settings?notice=${encodeURIComponent(`Cleared ${result.deleted} export file(s).`)}`);
  } catch (err) {
    res.redirect(`/settings?error=${encodeURIComponent(err.message)}`);
  }
});
router.post("/maintenance/purge-jobs", (req, res) => {
  try {
    const days = Number(req.body.days) || getRuntimeSettings().jobRetentionDays;
    const deleted = maintenance.purgeOldJobs(days);
    res.redirect(`/settings?notice=${encodeURIComponent(`Purged ${deleted} old job(s).`)}`);
  } catch (err) {
    res.redirect(`/settings?error=${encodeURIComponent(err.message)}`);
  }
});
router.post("/maintenance/purge-backup-runs", (req, res) => {
  try {
    const days = Number(req.body.days) || getRuntimeSettings().backupRunRetentionDays;
    const deleted = maintenance.purgeOldBackupRuns(days);
    res.redirect(`/settings?notice=${encodeURIComponent(`Purged ${deleted} backup run record(s).`)}`);
  } catch (err) {
    res.redirect(`/settings?error=${encodeURIComponent(err.message)}`);
  }
});
router.post("/maintenance/purge-all-jobs", (req, res) => {
  try {
    const deleted = maintenance.purgeAllCompletedJobs();
    res.redirect(`/settings?notice=${encodeURIComponent(`Removed ${deleted} completed/failed job(s).`)}`);
  } catch (err) {
    res.redirect(`/settings?error=${encodeURIComponent(err.message)}`);
  }
});
module.exports = router;
