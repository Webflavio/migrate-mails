const { getDb } = require("../db");
function createJob(type, input) {
  const info = getDb().prepare(`
    INSERT INTO jobs (type, status, input_json) VALUES (?, 'pending', ?)
  `).run(type, JSON.stringify(input || {}));
  return getJob(info.lastInsertRowid);
}
function getJob(id) {
  const job = getDb().prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (job && job.input_json) job.input = JSON.parse(job.input_json);
  if (job && job.result_json) job.result = JSON.parse(job.result_json);
  return job;
}
function listJobs(limit) {
  const rows = getDb().prepare("SELECT * FROM jobs ORDER BY id DESC LIMIT ?").all(limit || 50);
  return rows.map((job) => {
    if (job.input_json) job.input = JSON.parse(job.input_json);
    if (job.result_json) job.result = JSON.parse(job.result_json);
    return job;
  });
}
function updateJob(id, patch) {
  const fields = [];
  const params = { id };
  if (patch.status !== undefined) { fields.push("status = @status"); params.status = patch.status; }
  if (patch.progress !== undefined) { fields.push("progress = @progress"); params.progress = patch.progress; }
  if (patch.output_path !== undefined) { fields.push("output_path = @output_path"); params.output_path = patch.output_path; }
  if (patch.result !== undefined) { fields.push("result_json = @result_json"); params.result_json = JSON.stringify(patch.result); }
  if (patch.input !== undefined) { fields.push("input_json = @input_json"); params.input_json = JSON.stringify(patch.input); }
  if (patch.error_text !== undefined) { fields.push("error_text = @error_text"); params.error_text = patch.error_text; }
  if (patch.log_text !== undefined) { fields.push("log_text = @log_text"); params.log_text = patch.log_text; }
  if (patch.started_at) { fields.push("started_at = @started_at"); params.started_at = patch.started_at; }
  if (patch.finished_at) { fields.push("finished_at = @finished_at"); params.finished_at = patch.finished_at; }
  if (!fields.length) return getJob(id);
  getDb().prepare(`UPDATE jobs SET ${fields.join(", ")} WHERE id = @id`).run(params);
  return getJob(id);
}
function appendLog(id, line) {
  const ts = new Date().toISOString().slice(11, 19);
  getDb().prepare(`
    UPDATE jobs SET log_text = COALESCE(log_text, '') || ? || char(10) WHERE id = ?
  `).run(`[${ts}] ${line}`, id);
}
function getPendingJobs() {
  return getDb().prepare("SELECT * FROM jobs WHERE status = 'pending' ORDER BY id ASC").all();
}
function countByStatus(status) {
  return getDb().prepare("SELECT COUNT(*) AS total FROM jobs WHERE status = ?").get(status).total;
}
function isCancelled(id) {
  const job = getDb().prepare("SELECT status FROM jobs WHERE id = ?").get(id);
  return job && job.status === "cancelled";
}
function cancelJob(id) {
  const job = getJob(id);
  if (!job || !["pending", "running"].includes(job.status)) return null;
  return updateJob(id, { status: "cancelled", finished_at: new Date().toISOString() });
}
function deleteJob(id) {
  return getDb().prepare("DELETE FROM jobs WHERE id = ?").run(id);
}
function deleteByStatuses(statuses) {
  if (!statuses.length) return 0;
  const placeholders = statuses.map(() => "?").join(",");
  const info = getDb().prepare(`DELETE FROM jobs WHERE status IN (${placeholders})`).run(...statuses);
  return info.changes;
}
function deleteOlderThan(days) {
  const info = getDb().prepare(`
    DELETE FROM jobs
    WHERE status IN ('completed', 'failed', 'cancelled')
      AND finished_at IS NOT NULL
      AND datetime(finished_at) < datetime('now', '-' || ? || ' days')
  `).run(days);
  return info.changes;
}
module.exports = { createJob, getJob, listJobs, updateJob, appendLog, getPendingJobs, countByStatus, isCancelled, cancelJob, deleteJob, deleteByStatuses, deleteOlderThan };
