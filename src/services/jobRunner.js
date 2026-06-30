const jobsRepo = require("../repos/jobs");
const backupService = require("./backup");
const exportService = require("./export");
const migrateService = require("./migrate");
const indexerService = require("./indexer");
function buildCallbacks(job) {
  const onProgress = (patch) => {
    const update = {};
    if (patch.progress !== undefined) update.progress = patch.progress;
    if (patch.result !== undefined) update.result = patch.result;
    jobsRepo.updateJob(job.id, update);
    if (patch.log) jobsRepo.appendLog(job.id, patch.log);
  };
  return onProgress;
}
async function processJob(job) {
  jobsRepo.updateJob(job.id, { status: "running", started_at: new Date().toISOString(), progress: 0, log_text: "" });
  jobsRepo.appendLog(job.id, `Job ${job.type} started`);
  const onProgress = buildCallbacks(job);
  try {
    let result;
    if (job.type === "backup") {
      result = await backupService.runBackup(job.input.accountId, onProgress, job.id, job.input);
    } else if (job.type === "export") {
      if (job.input.format === "mbox") {
        result = await exportService.exportMbox(job.input.accountId, job.input, onProgress);
      } else {
        result = await exportService.exportEmlZip(job.input.accountId, job.input, onProgress);
      }
    } else if (job.type === "migrate") {
      result = await migrateService.runMigration(job.input.migrationId, onProgress);
    } else if (job.type === "index-legacy") {
      result = await indexerService.indexLegacyBackup(job.input.accountId, (p) => {
        onProgress({ progress: 50, result: p });
        if (p && p.log) jobsRepo.appendLog(job.id, p.log);
      });
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }
    if (jobsRepo.isCancelled(job.id)) {
      jobsRepo.appendLog(job.id, "Job cancelled");
      return;
    }
    jobsRepo.updateJob(job.id, {
      status: "completed",
      progress: 100,
      result,
      output_path: result.outputPath || null,
      finished_at: new Date().toISOString(),
    });
    jobsRepo.appendLog(job.id, "Job completed");
  } catch (err) {
    const status = jobsRepo.isCancelled(job.id) ? "cancelled" : "failed";
    jobsRepo.appendLog(job.id, status === "cancelled" ? "Job cancelled" : `Job failed: ${err.message}`);
    jobsRepo.updateJob(job.id, {
      status,
      error_text: err.message,
      finished_at: new Date().toISOString(),
    });
  }
}
async function tick() {
  if (tick.running) return;
  tick.running = true;
  try {
    const pending = jobsRepo.getPendingJobs();
    for (const job of pending) {
      if (job.input_json) job.input = JSON.parse(job.input_json);
      await processJob(job);
    }
  } finally {
    tick.running = false;
  }
}
function startJobRunner(intervalMs) {
  setInterval(tick, intervalMs || 2000);
  tick();
}
module.exports = { startJobRunner, processJob, tick };
