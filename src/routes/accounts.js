const express = require("express");
const { z } = require("zod");
const accountsRepo = require("../repos/accounts");
const foldersRepo = require("../repos/folders");
const backupRunsRepo = require("../repos/backupRuns");
const jobsRepo = require("../repos/jobs");
const { testConnection } = require("../lib/imap");
const { parseBool } = require("../lib/parseBool");
const { scanAccountFolders } = require("../services/backupScan");
const maintenance = require("../services/maintenance");
const { getAccountStorageSize, formatBytes } = require("../lib/storage");
const asyncHandler = require("../middleware/asyncHandler");
const router = express.Router();
const accountSchema = z.object({
  label: z.string().min(1).max(120),
  imap_host: z.string().min(1),
  imap_port: z.coerce.number().default(993),
  imap_secure: z.preprocess((val) => parseBool(val, true), z.boolean()),
  username: z.string().min(1),
  password: z.string().optional(),
});
router.get("/", asyncHandler(async (req, res) => {
  res.render("pages/accounts/index", { title: "Accounts", accounts: await accountsRepo.listAccounts() });
}));
router.get("/new", (req, res) => {
  res.render("pages/accounts/form", { title: "Add Account", account: null, error: null });
});
router.post("/", asyncHandler(async (req, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success || !req.body.password) {
    return res.render("pages/accounts/form", { title: "Add Account", account: req.body, error: "All fields including password are required." });
  }
  const account = await accountsRepo.createAccount({ ...parsed.data, password: req.body.password });
  res.redirect(`/accounts/${account.id}`);
}));
router.get("/:id", asyncHandler(async (req, res) => {
  const account = await accountsRepo.getAccount(Number(req.params.id));
  if (!account) return res.status(404).render("pages/error", { title: "Not Found", message: "Account not found." });
  const folders = await foldersRepo.listFolders(account.id);
  const runs = await backupRunsRepo.listRuns(account.id, 10);
  const backupStats = await maintenance.getAccountBackupStats(account.id);
  backupStats.storageBytes = getAccountStorageSize(account.id);
  let notice = null;
  let error = null;
  if (req.query.test === "ok") notice = "Connection successful.";
  else if (req.query.test === "fail") error = req.query.msg || "Connection failed.";
  else if (req.query.backup === "queued") notice = "Backup job queued.";
  else if (req.query.index === "queued") notice = "Legacy index job queued.";
  else if (req.query.notice) notice = req.query.notice;
  else if (req.query.error) error = req.query.error;
  res.render("pages/accounts/show", { title: account.label, account, folders, runs, backupStats, notice, error });
}));
router.get("/:id/edit", asyncHandler(async (req, res) => {
  const account = await accountsRepo.getAccount(Number(req.params.id));
  if (!account) return res.status(404).render("pages/error", { title: "Not Found", message: "Account not found." });
  res.render("pages/accounts/form", { title: "Edit Account", account, error: null });
}));
router.post("/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.render("pages/accounts/form", { title: "Edit Account", account: { ...req.body, id }, error: "Invalid account data." });
  }
  await accountsRepo.updateAccount(id, { ...parsed.data, password: req.body.password || undefined });
  res.redirect(`/accounts/${id}`);
}));
router.post("/:id/delete", asyncHandler(async (req, res) => {
  const accountId = Number(req.params.id);
  try {
    await maintenance.deleteAccountBackupData(accountId);
  } catch (_) {}
  await accountsRepo.deleteAccount(accountId);
  res.redirect("/accounts");
}));
router.post("/:id/test", asyncHandler(async (req, res) => {
  const account = await accountsRepo.getAccount(Number(req.params.id));
  if (!account) return res.status(404).json({ ok: false, error: "Not found" });
  try {
    const password = accountsRepo.getPassword(account);
    const result = await testConnection(account, password);
    await accountsRepo.setAccountStatus(account.id, "connected");
    if (req.headers.accept && req.headers.accept.includes("json")) return res.json(result);
    res.redirect(`/accounts/${account.id}?test=ok`);
  } catch (err) {
    await accountsRepo.setAccountStatus(account.id, "error");
    const message = err.message || "Connection failed";
    if (req.headers.accept && req.headers.accept.includes("json")) return res.status(400).json({ ok: false, error: message });
    res.redirect(`/accounts/${account.id}?test=fail&msg=${encodeURIComponent(message)}`);
  }
}));
router.get("/:id/backup", asyncHandler(async (req, res) => {
  const account = await accountsRepo.getAccount(Number(req.params.id));
  if (!account) return res.status(404).render("pages/error", { title: "Not Found", message: "Account not found." });
  res.render("pages/accounts/backup", { title: `Backup — ${account.label}`, account });
}));
router.post("/:id/backup/scan", asyncHandler(async (req, res) => {
  const accountId = Number(req.params.id);
  const account = await accountsRepo.getAccount(accountId);
  if (!account) return res.status(404).json({ ok: false, error: "Account not found" });
  try {
    const folderNames = req.body.folders ? (Array.isArray(req.body.folders) ? req.body.folders : [req.body.folders]) : null;
    const includeSizes = parseBool(req.body.includeSizes, false);
    const scan = await scanAccountFolders(accountId, { includeSizes, folderNames });
    res.json({ ok: true, scan });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}));
router.post("/:id/backup", asyncHandler(async (req, res) => {
  const accountId = Number(req.params.id);
  const folderNames = req.body.folders ? (Array.isArray(req.body.folders) ? req.body.folders : [req.body.folders]).filter(Boolean) : [];
  const incremental = parseBool(req.body.incremental, true);
  if (folderNames.length) {
    const allFolders = (await foldersRepo.listFolders(accountId)).map((f) => f.remote_name);
    const unselected = allFolders.filter((name) => !folderNames.includes(name));
    await foldersRepo.setIncludedForAccount(accountId, folderNames, true);
    if (unselected.length) await foldersRepo.setIncludedForAccount(accountId, unselected, false);
  }
  const job = await jobsRepo.createJob("backup", { accountId, folderNames, incremental });
  if (req.headers.accept && req.headers.accept.includes("json")) {
    return res.json({ ok: true, jobId: job.id });
  }
  res.redirect(`/jobs/${job.id}`);
}));
router.post("/:id/backup/quick", asyncHandler(async (req, res) => {
  const accountId = Number(req.params.id);
  const job = await jobsRepo.createJob("backup", { accountId, incremental: true });
  res.redirect(`/jobs/${job.id}`);
}));
router.post("/:id/index-legacy", asyncHandler(async (req, res) => {
  const accountId = Number(req.params.id);
  await jobsRepo.createJob("index-legacy", { accountId });
  res.redirect(`/accounts/${accountId}?index=queued`);
}));
router.post("/:id/folders/:folderId/toggle", asyncHandler(async (req, res) => {
  const folder = await foldersRepo.getFolder(Number(req.params.folderId));
  if (folder) await foldersRepo.setIncluded(folder.id, req.body.included === "1" ? 1 : 0);
  res.redirect(`/accounts/${req.params.id}`);
}));
router.post("/:id/delete-backup", asyncHandler(async (req, res) => {
  try {
    const accountId = Number(req.params.id);
    const result = await maintenance.deleteAccountBackupData(accountId);
    res.redirect(`/accounts/${accountId}?notice=${encodeURIComponent(`Deleted ${result.deletedMessages} backed-up message(s). Account kept.`)}`);
  } catch (err) {
    res.redirect(`/accounts/${req.params.id}?error=${encodeURIComponent(err.message)}`);
  }
}));
router.post("/:id/folders/:folderId/clear", asyncHandler(async (req, res) => {
  try {
    const result = await maintenance.deleteFolderBackupData(Number(req.params.folderId));
    res.redirect(`/accounts/${req.params.id}?notice=${encodeURIComponent(`Cleared ${result.deletedMessages} message(s) from folder.`)}`);
  } catch (err) {
    res.redirect(`/accounts/${req.params.id}?error=${encodeURIComponent(err.message)}`);
  }
}));
module.exports = router;
