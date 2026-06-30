const { query, queryOne, execute } = require("../db");
function parseJob(job) {
  if (!job) return job;
  if (job.input_json) job.input = JSON.parse(job.input_json);
  if (job.result_json) job.result = JSON.parse(job.result_json);
  return job;
}
async function createJob(type, input) {
  const info = await execute("INSERT INTO jobs (type, status, input_json, log_text) VALUES (?, 'pending', ?, '')", [type, JSON.stringify(input || {})]);
  return getJob(info.lastInsertRowid);
}
async function getJob(id) {
  return parseJob(await queryOne("SELECT * FROM jobs WHERE id = ?", [id]));
}
async function listJobs(limit) {
  const rows = await query("SELECT * FROM jobs ORDER BY id DESC LIMIT ?", [limit || 50]);
  return rows.map(parseJob);
}
async function updateJob(id, patch) {
  const fields = [];
  const params = [];
  if (patch.status !== undefined) { fields.push("status = ?"); params.push(patch.status); }
  if (patch.progress !== undefined) { fields.push("progress = ?"); params.push(patch.progress); }
  if (patch.output_path !== undefined) { fields.push("output_path = ?"); params.push(patch.output_path); }
  if (patch.result !== undefined) { fields.push("result_json = ?"); params.push(JSON.stringify(patch.result)); }
  if (patch.input !== undefined) { fields.push("input_json = ?"); params.push(JSON.stringify(patch.input)); }
  if (patch.error_text !== undefined) { fields.push("error_text = ?"); params.push(patch.error_text); }
  if (patch.log_text !== undefined) { fields.push("log_text = ?"); params.push(patch.log_text); }
  if (patch.started_at) { fields.push("started_at = ?"); params.push(patch.started_at); }
  if (patch.finished_at) { fields.push("finished_at = ?"); params.push(patch.finished_at); }
  if (!fields.length) return getJob(id);
  params.push(id);
  await execute(`UPDATE jobs SET ${fields.join(", ")} WHERE id = ?`, params);
  return getJob(id);
}
async function appendLog(id, line) {
  const ts = new Date().toISOString().slice(11, 19);
  await execute("UPDATE jobs SET log_text = CONCAT(COALESCE(log_text, ''), ?, CHAR(10)) WHERE id = ?", [`[${ts}] ${line}`, id]);
}
async function getPendingJobs() {
  return query("SELECT * FROM jobs WHERE status = 'pending' ORDER BY id ASC");
}
async function countByStatus(status) {
  const row = await queryOne("SELECT COUNT(*) AS total FROM jobs WHERE status = ?", [status]);
  return row.total;
}
async function isCancelled(id) {
  const job = await queryOne("SELECT status FROM jobs WHERE id = ?", [id]);
  return job && job.status === "cancelled";
}
async function cancelJob(id) {
  const job = await getJob(id);
  if (!job || !["pending", "running"].includes(job.status)) return null;
  return updateJob(id, { status: "cancelled", finished_at: new Date().toISOString() });
}
async function deleteJob(id) {
  return execute("DELETE FROM jobs WHERE id = ?", [id]);
}
async function deleteByStatuses(statuses) {
  if (!statuses.length) return 0;
  const placeholders = statuses.map(() => "?").join(",");
  const info = await execute(`DELETE FROM jobs WHERE status IN (${placeholders})`, statuses);
  return info.changes;
}
async function deleteOlderThan(days) {
  const info = await execute(`
    DELETE FROM jobs
    WHERE status IN ('completed', 'failed', 'cancelled')
      AND finished_at IS NOT NULL
      AND finished_at < DATE_SUB(NOW(), INTERVAL ? DAY)
  `, [days]);
  return info.changes;
}
module.exports = { createJob, getJob, listJobs, updateJob, appendLog, getPendingJobs, countByStatus, isCancelled, cancelJob, deleteJob, deleteByStatuses, deleteOlderThan };
