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
    jobsRepo.updateJob(job.id, update).catch(() => {});
    if (patch.log) jobsRepo.appendLog(job.id, patch.log).catch(() => {});
  };
  return onProgress;
}
async function processJob(job) {
  await jobsRepo.updateJob(job.id, { status: "running", started_at: new Date().toISOString(), progress: 0, log_text: "" });
  await jobsRepo.appendLog(job.id, `Job ${job.type} started`);
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
        if (p && p.log) jobsRepo.appendLog(job.id, p.log).catch(() => {});
      });
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }
    if (await jobsRepo.isCancelled(job.id)) {
      await jobsRepo.appendLog(job.id, "Job cancelled");
      return;
    }
    await jobsRepo.updateJob(job.id, {
      status: "completed",
      progress: 100,
      result,
      output_path: result.outputPath || null,
      finished_at: new Date().toISOString(),
    });
    await jobsRepo.appendLog(job.id, "Job completed");
  } catch (err) {
    const status = (await jobsRepo.isCancelled(job.id)) ? "cancelled" : "failed";
    await jobsRepo.appendLog(job.id, status === "cancelled" ? "Job cancelled" : `Job failed: ${err.message}`);
    await jobsRepo.updateJob(job.id, {
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
    const pending = await jobsRepo.getPendingJobs();
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
