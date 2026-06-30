const express = require("express");
const path = require("path");
const fs = require("fs");
const accountsRepo = require("../repos/accounts");
const foldersRepo = require("../repos/folders");
const jobsRepo = require("../repos/jobs");
const config = require("../config");
const asyncHandler = require("../middleware/asyncHandler");
const router = express.Router();
router.get("/", asyncHandler(async (req, res) => {
  const accounts = await accountsRepo.listAccounts();
  const jobs = (await jobsRepo.listJobs(20)).filter((j) => j.type === "export");
  res.render("pages/export/index", { title: "Export", accounts, jobs });
}));
router.post("/", asyncHandler(async (req, res) => {
  const accountId = Number(req.body.accountId);
  const format = req.body.format === "mbox" ? "mbox" : "eml-zip";
  const folderIds = req.body.folderIds ? (Array.isArray(req.body.folderIds) ? req.body.folderIds.map(Number) : [Number(req.body.folderIds)]) : [];
  await jobsRepo.createJob("export", { accountId, format, folderIds });
  res.redirect("/export?queued=1");
}));
router.get("/download/:jobId", asyncHandler(async (req, res) => {
  const job = await jobsRepo.getJob(Number(req.params.jobId));
  if (!job || !job.output_path || !fs.existsSync(job.output_path)) return res.status(404).send("Export file not found");
  res.download(job.output_path, path.basename(job.output_path));
}));
router.get("/folders/:accountId", asyncHandler(async (req, res) => {
  const folders = await foldersRepo.listFolders(Number(req.params.accountId));
  res.json(folders);
}));
module.exports = router;
