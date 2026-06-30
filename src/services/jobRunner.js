const jobsRepo = require("../repos/jobs");
const backupService = require("./backup");
const exportService = require("./export");
const migrateService = require("./migrate");
const indexerService = require("./indexer");
const migrationsRepo = require("../repos/migrations");
let running = false;
async function processJob(job) {
  jobsRepo.updateJob(job.id, { status: "running", started_at: new Date().toISOString(), progress: 0 });
  const onProgress = (patch) => jobsRepo.updateJob(job.id, patch);
  try {
    let result;
    if (job.type === "backup") {
      result = await backupService.runBackup(job.input.accountId, onProgress);
    } else if (job.type === "export") {
      if (job.input.format === "mbox") {
        result = await exportService.exportMbox(job.input.accountId, job.input, onProgress);
      } else {
        result = await exportService.exportEmlZip(job.input.accountId, job.input, onProgress);
      }
    } else if (job.type === "migrate") {
      result = await migrateService.runMigration(job.input.migrationId, onProgress);
    } else if (job.type === "index-legacy") {
      result = await indexerService.indexLegacyBackup(job.input.accountId, (p) => onProgress({ progress: 50, result: p }));
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }
    jobsRepo.updateJob(job.id, {
      status: "completed",
      progress: 100,
      result,
      output_path: result.outputPath || null,
      finished_at: new Date().toISOString(),
    });
  } catch (err) {
    jobsRepo.updateJob(job.id, {
      status: "failed",
      error_text: err.message,
      finished_at: new Date().toISOString(),
    });
  }
}
async function tick() {
  if (running) return;
  running = true;
  try {
    const pending = jobsRepo.getPendingJobs();
    for (const job of pending) {
      if (job.input_json) job.input = JSON.parse(job.input_json);
      await processJob(job);
    }
  } finally {
    running = false;
  }
}
function startJobRunner(intervalMs) {
  setInterval(tick, intervalMs || 2000);
  tick();
}
module.exports = { startJobRunner, processJob, tick };
