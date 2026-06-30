const express = require("express");
const accountsRepo = require("../repos/accounts");
const backupRunsRepo = require("../repos/backupRuns");
const maintenance = require("../services/maintenance");
const router = express.Router();
router.get("/", (req, res) => {
  const runs = backupRunsRepo.listRuns(null, 100);
  const accounts = accountsRepo.listAccounts();
  res.render("pages/backups/index", {
    title: "Backups",
    runs,
    accounts,
    notice: req.query.notice || null,
    error: req.query.error || null,
  });
});
router.post("/account/:accountId/delete-data", (req, res) => {
  try {
    const accountId = Number(req.params.accountId);
    const result = maintenance.deleteAccountBackupData(accountId);
    res.redirect(`/backups?notice=${encodeURIComponent(`Deleted ${result.deletedMessages} backed-up message(s) for this account.`)}`);
  } catch (err) {
    res.redirect(`/backups?error=${encodeURIComponent(err.message)}`);
  }
});
router.post("/runs/:id/delete", (req, res) => {
  backupRunsRepo.deleteRun(Number(req.params.id));
  res.redirect("/backups?notice=Backup%20run%20record%20deleted.");
});
router.post("/folder/:folderId/delete-data", (req, res) => {
  try {
    const result = maintenance.deleteFolderBackupData(Number(req.params.folderId));
    const accountId = req.body.accountId;
    res.redirect(`/accounts/${accountId}?notice=${encodeURIComponent(`Cleared ${result.deletedMessages} message(s) from folder.`)}`);
  } catch (err) {
    const accountId = req.body.accountId || "";
    res.redirect(`/accounts/${accountId}?error=${encodeURIComponent(err.message)}`);
  }
});
module.exports = router;
