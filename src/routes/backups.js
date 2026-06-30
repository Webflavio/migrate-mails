const express = require("express");
const accountsRepo = require("../repos/accounts");
const backupRunsRepo = require("../repos/backupRuns");
const maintenance = require("../services/maintenance");
const asyncHandler = require("../middleware/asyncHandler");
const router = express.Router();
router.get("/", asyncHandler(async (req, res) => {
  const runs = await backupRunsRepo.listRuns(null, 100);
  const accounts = await accountsRepo.listAccounts();
  res.render("pages/backups/index", {
    title: "Backups",
    runs,
    accounts,
    notice: req.query.notice || null,
    error: req.query.error || null,
  });
}));
router.post("/account/:accountId/delete-data", asyncHandler(async (req, res) => {
  try {
    const accountId = Number(req.params.accountId);
    const result = await maintenance.deleteAccountBackupData(accountId);
    res.redirect(`/backups?notice=${encodeURIComponent(`Deleted ${result.deletedMessages} backed-up message(s) for this account.`)}`);
  } catch (err) {
    res.redirect(`/backups?error=${encodeURIComponent(err.message)}`);
  }
}));
router.post("/runs/:id/delete", asyncHandler(async (req, res) => {
  await backupRunsRepo.deleteRun(Number(req.params.id));
  res.redirect("/backups?notice=Backup%20run%20record%20deleted.");
}));
router.post("/folder/:folderId/delete-data", asyncHandler(async (req, res) => {
  try {
    const result = await maintenance.deleteFolderBackupData(Number(req.params.folderId));
    const accountId = req.body.accountId;
    res.redirect(`/accounts/${accountId}?notice=${encodeURIComponent(`Cleared ${result.deletedMessages} message(s) from folder.`)}`);
  } catch (err) {
    const accountId = req.body.accountId || "";
    res.redirect(`/accounts/${accountId}?error=${encodeURIComponent(err.message)}`);
  }
}));
module.exports = router;
