const express = require("express");
const jobsRepo = require("../repos/jobs");
const backupRunsRepo = require("../repos/backupRuns");
const router = express.Router();
router.get("/", (req, res) => {
  res.render("pages/jobs/index", {
    title: "Jobs",
    jobs: jobsRepo.listJobs(100),
    runs: backupRunsRepo.listRuns(null, 50),
    notice: req.query.notice || null,
    error: req.query.error || null,
  });
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
router.post("/:id/delete", (req, res) => {
  const job = jobsRepo.getJob(Number(req.params.id));
  if (!job) return res.status(404).redirect("/jobs?error=Job%20not%20found");
  if (job.status === "running") return res.status(400).redirect("/jobs?error=Cannot%20delete%20a%20running%20job");
  jobsRepo.deleteJob(job.id);
  res.redirect("/jobs?notice=Job%20deleted.");
});
router.get("/:id", (req, res) => {
  const job = jobsRepo.getJob(Number(req.params.id));
  if (!job) return res.status(404).render("pages/error", { title: "Not Found", message: "Job not found." });
  res.render("pages/jobs/show", { title: `Job #${job.id}`, job });
});
module.exports = router;
