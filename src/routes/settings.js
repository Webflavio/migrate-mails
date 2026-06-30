const express = require("express");
const config = require("../config");
const settingsRepo = require("../repos/settings");
const { getStorageSize, formatBytes } = require("../lib/storage");
const exportService = require("../services/export");
const router = express.Router();
router.get("/", (req, res) => {
  const settings = settingsRepo.getAllSettings();
  res.render("pages/settings/index", {
    title: "Settings",
    settings,
    config,
    storageSize: formatBytes(getStorageSize()),
    saved: req.query.saved === "1",
  });
});
router.post("/", (req, res) => {
  if (req.body.export_retention_days) settingsRepo.setSetting("export_retention_days", String(req.body.export_retention_days));
  if (req.body.max_message_mb) settingsRepo.setSetting("max_message_mb", String(req.body.max_message_mb));
  exportService.cleanupOldExports();
  res.redirect("/settings?saved=1");
});
module.exports = router;
