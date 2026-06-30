const express = require("express");
const jobsRepo = require("../repos/jobs");
const backupRunsRepo = require("../repos/backupRuns");
const router = express.Router();
router.get("/", (req, res) => {
  res.render("pages/jobs/index", { title: "Jobs", jobs: jobsRepo.listJobs(100), runs: backupRunsRepo.listRuns(null, 50) });
});
router.get("/:id", (req, res) => {
  const job = jobsRepo.getJob(Number(req.params.id));
  if (!job) return res.status(404).render("pages/error", { title: "Not Found", message: "Job not found." });
  res.render("pages/jobs/show", { title: `Job #${job.id}`, job });
});
module.exports = router;
