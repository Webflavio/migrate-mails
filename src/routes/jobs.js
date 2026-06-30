const express = require("express");
const jobsRepo = require("../repos/jobs");
const backupRunsRepo = require("../repos/backupRuns");
const router = express.Router();
router.get("/", (req, res) => {
  res.render("pages/jobs/index", { title: "Jobs", jobs: jobsRepo.listJobs(100), runs: backupRunsRepo.listRuns(null, 50) });
});
router.get("/:id/live", (req, res) => {
  const job = jobsRepo.getJob(Number(req.params.id));
  if (!job) return res.status(404).json({ error: "Not found" });
  res.json({
    id: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress,
    log: job.log_text || "",
    result: job.result || null,
    error: job.error_text || null,
    started_at: job.started_at,
    finished_at: job.finished_at,
  });
});
router.post("/:id/cancel", (req, res) => {
  const job = jobsRepo.cancelJob(Number(req.params.id));
  if (!job) return res.status(400).json({ ok: false, error: "Job cannot be cancelled" });
  res.json({ ok: true, job });
});
router.get("/:id", (req, res) => {
  const job = jobsRepo.getJob(Number(req.params.id));
  if (!job) return res.status(404).render("pages/error", { title: "Not Found", message: "Job not found." });
  res.render("pages/jobs/show", { title: `Job #${job.id}`, job });
});
module.exports = router;
