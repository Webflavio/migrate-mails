const express = require("express");
const { z } = require("zod");
const accountsRepo = require("../repos/accounts");
const foldersRepo = require("../repos/folders");
const backupRunsRepo = require("../repos/backupRuns");
const jobsRepo = require("../repos/jobs");
const { testConnection } = require("../lib/imap");
const { parseBool } = require("../lib/parseBool");
const router = express.Router();
const accountSchema = z.object({
  label: z.string().min(1).max(120),
  imap_host: z.string().min(1),
  imap_port: z.coerce.number().default(993),
  imap_secure: z.preprocess((val) => parseBool(val, true), z.boolean()),
  username: z.string().min(1),
  password: z.string().optional(),
});
router.get("/", (req, res) => {
  res.render("pages/accounts/index", { title: "Accounts", accounts: accountsRepo.listAccounts() });
});
router.get("/new", (req, res) => {
  res.render("pages/accounts/form", { title: "Add Account", account: null, error: null });
});
router.post("/", async (req, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success || !req.body.password) {
    return res.render("pages/accounts/form", { title: "Add Account", account: req.body, error: "All fields including password are required." });
  }
  const account = accountsRepo.createAccount({ ...parsed.data, password: req.body.password });
  res.redirect(`/accounts/${account.id}`);
});
router.get("/:id", (req, res) => {
  const account = accountsRepo.getAccount(Number(req.params.id));
  if (!account) return res.status(404).render("pages/error", { title: "Not Found", message: "Account not found." });
  const folders = foldersRepo.listFolders(account.id);
  const runs = backupRunsRepo.listRuns(account.id, 10);
  let notice = null;
  let error = null;
  if (req.query.test === "ok") notice = "Connection successful.";
  else if (req.query.test === "fail") error = req.query.msg || "Connection failed.";
  else if (req.query.backup === "queued") notice = "Backup job queued.";
  else if (req.query.index === "queued") notice = "Legacy index job queued.";
  res.render("pages/accounts/show", { title: account.label, account, folders, runs, notice, error });
});
router.get("/:id/edit", (req, res) => {
  const account = accountsRepo.getAccount(Number(req.params.id));
  if (!account) return res.status(404).render("pages/error", { title: "Not Found", message: "Account not found." });
  res.render("pages/accounts/form", { title: "Edit Account", account, error: null });
});
router.post("/:id", (req, res) => {
  const id = Number(req.params.id);
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.render("pages/accounts/form", { title: "Edit Account", account: { ...req.body, id }, error: "Invalid account data." });
  }
  accountsRepo.updateAccount(id, { ...parsed.data, password: req.body.password || undefined });
  res.redirect(`/accounts/${id}`);
});
router.post("/:id/delete", (req, res) => {
  accountsRepo.deleteAccount(Number(req.params.id));
  res.redirect("/accounts");
});
router.post("/:id/test", async (req, res) => {
  const account = accountsRepo.getAccount(Number(req.params.id));
  if (!account) return res.status(404).json({ ok: false, error: "Not found" });
  try {
    const password = accountsRepo.getPassword(account);
    const result = await testConnection(account, password);
    accountsRepo.setAccountStatus(account.id, "connected");
    if (req.headers.accept && req.headers.accept.includes("json")) return res.json(result);
    res.redirect(`/accounts/${account.id}?test=ok`);
  } catch (err) {
    accountsRepo.setAccountStatus(account.id, "error");
    const message = err.message || "Connection failed";
    if (req.headers.accept && req.headers.accept.includes("json")) return res.status(400).json({ ok: false, error: message });
    res.redirect(`/accounts/${account.id}?test=fail&msg=${encodeURIComponent(message)}`);
  }
});
router.post("/:id/backup", (req, res) => {
  const accountId = Number(req.params.id);
  jobsRepo.createJob("backup", { accountId });
  res.redirect(`/accounts/${accountId}?backup=queued`);
});
router.post("/:id/index-legacy", (req, res) => {
  const accountId = Number(req.params.id);
  jobsRepo.createJob("index-legacy", { accountId });
  res.redirect(`/accounts/${accountId}?index=queued`);
});
router.post("/:id/folders/:folderId/toggle", (req, res) => {
  const folder = foldersRepo.getFolder(Number(req.params.folderId));
  if (folder) foldersRepo.setIncluded(folder.id, req.body.included === "1" ? 1 : 0);
  res.redirect(`/accounts/${req.params.id}`);
});
module.exports = router;
