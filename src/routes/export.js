const express = require("express");
const path = require("path");
const fs = require("fs");
const accountsRepo = require("../repos/accounts");
const foldersRepo = require("../repos/folders");
const jobsRepo = require("../repos/jobs");
const config = require("../config");
const router = express.Router();
router.get("/", (req, res) => {
  const accounts = accountsRepo.listAccounts();
  res.render("pages/export/index", { title: "Export", accounts, jobs: jobsRepo.listJobs(20).filter((j) => j.type === "export") });
});
router.post("/", (req, res) => {
  const accountId = Number(req.body.accountId);
  const format = req.body.format === "mbox" ? "mbox" : "eml-zip";
  const folderIds = req.body.folderIds ? (Array.isArray(req.body.folderIds) ? req.body.folderIds.map(Number) : [Number(req.body.folderIds)]) : [];
  jobsRepo.createJob("export", { accountId, format, folderIds });
  res.redirect("/export?queued=1");
});
router.get("/download/:jobId", (req, res) => {
  const job = jobsRepo.getJob(Number(req.params.jobId));
  if (!job || !job.output_path || !fs.existsSync(job.output_path)) return res.status(404).send("Export file not found");
  res.download(job.output_path, path.basename(job.output_path));
});
router.get("/folders/:accountId", (req, res) => {
  const folders = foldersRepo.listFolders(Number(req.params.accountId));
  res.json(folders);
});
module.exports = router;
