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
  if (patch.started_at) { fields.push("started_at = @started_at"); params.started_at = patch.started_at; }
  if (patch.finished_at) { fields.push("finished_at = @finished_at"); params.finished_at = patch.finished_at; }
  if (!fields.length) return getJob(id);
  getDb().prepare(`UPDATE jobs SET ${fields.join(", ")} WHERE id = @id`).run(params);
  return getJob(id);
}
function getPendingJobs() {
  return getDb().prepare("SELECT * FROM jobs WHERE status = 'pending' ORDER BY id ASC").all();
}
function countByStatus(status) {
  return getDb().prepare("SELECT COUNT(*) AS total FROM jobs WHERE status = ?").get(status).total;
}
module.exports = { createJob, getJob, listJobs, updateJob, getPendingJobs, countByStatus };
