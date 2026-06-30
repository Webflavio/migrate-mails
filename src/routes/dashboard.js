const express = require("express");
const path = require("path");
const accountsRepo = require("../repos/accounts");
const foldersRepo = require("../repos/folders");
const messagesRepo = require("../repos/messages");
const backupRunsRepo = require("../repos/backupRuns");
const jobsRepo = require("../repos/jobs");
const { getStorageSize, formatBytes } = require("../lib/storage");
const router = express.Router();
router.get("/", (req, res) => {
  const accounts = accountsRepo.listAccounts();
  const runs = backupRunsRepo.listRuns(null, 10);
  const jobs = jobsRepo.listJobs(10);
  const stats = {
    accountCount: accounts.length,
    messageCount: messagesRepo.totalCount(),
    storageSize: formatBytes(getStorageSize()),
    failedJobs: jobsRepo.countByStatus("failed"),
    runningJobs: jobsRepo.countByStatus("running"),
  };
  res.render("pages/dashboard", { title: "Dashboard", accounts, runs, jobs, stats });
});
module.exports = router;
