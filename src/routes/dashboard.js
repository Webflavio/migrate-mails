const express = require("express");
const accountsRepo = require("../repos/accounts");
const foldersRepo = require("../repos/folders");
const messagesRepo = require("../repos/messages");
const backupRunsRepo = require("../repos/backupRuns");
const jobsRepo = require("../repos/jobs");
const { getStorageSize, formatBytes } = require("../lib/storage");
const asyncHandler = require("../middleware/asyncHandler");
const router = express.Router();
router.get("/", asyncHandler(async (req, res) => {
  const accounts = await accountsRepo.listAccounts();
  const runs = await backupRunsRepo.listRuns(null, 10);
  const jobs = await jobsRepo.listJobs(10);
  const stats = {
    accountCount: accounts.length,
    messageCount: await messagesRepo.totalCount(),
    storageSize: formatBytes(getStorageSize()),
    failedJobs: await jobsRepo.countByStatus("failed"),
    runningJobs: await jobsRepo.countByStatus("running"),
  };
  res.render("pages/dashboard", { title: "Dashboard", accounts, runs, jobs, stats });
}));
module.exports = router;
