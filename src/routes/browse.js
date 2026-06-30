const express = require("express");
const accountsRepo = require("../repos/accounts");
const foldersRepo = require("../repos/folders");
const messagesRepo = require("../repos/messages");
const { readRawMessage } = require("../lib/storage");
const asyncHandler = require("../middleware/asyncHandler");
const router = express.Router();
router.get("/", (req, res) => {
  res.redirect("/browse/search");
});
router.get("/search", asyncHandler(async (req, res) => {
  const accountId = req.query.account ? Number(req.query.account) : null;
  const folderId = req.query.folder ? Number(req.query.folder) : null;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 50;
  const filters = {
    accountId,
    folderId,
    q: req.query.q || "",
    hasAttachments: req.query.attachments === "1",
    fromDate: req.query.from || null,
    toDate: req.query.to || null,
    limit,
    offset: (page - 1) * limit,
  };
  const messages = await messagesRepo.searchMessages(filters);
  const total = await messagesRepo.countMessages(filters);
  const accounts = await accountsRepo.listAccounts();
  const folders = accountId ? await foldersRepo.listFolders(accountId) : [];
  res.render("pages/browse/index", {
    title: "Browse",
    accounts,
    accountId,
    folderId,
    q: filters.q,
    messages,
    folders,
    total,
    page,
    filters,
  });
}));
router.get("/messages/:id", asyncHandler(async (req, res) => {
  const message = await messagesRepo.getMessage(Number(req.params.id));
  if (!message) return res.status(404).render("pages/error", { title: "Not Found", message: "Message not found." });
  const attachments = await messagesRepo.getAttachments(message.id);
  res.render("pages/browse/message", { title: message.subject || "Message", message, attachments });
}));
router.get("/messages/:id/raw", asyncHandler(async (req, res) => {
  const message = await messagesRepo.getMessage(Number(req.params.id));
  if (!message) return res.status(404).send("Not found");
  const raw = readRawMessage(message.raw_path);
  res.setHeader("Content-Type", "message/rfc822");
  res.setHeader("Content-Disposition", `attachment; filename="message-${message.id}.eml"`);
  res.send(raw);
}));
module.exports = router;
