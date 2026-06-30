const express = require("express");
const rateLimit = require("express-rate-limit");
const { createSessionCookie, clearSessionCookie, verifyPassword } = require("../lib/session");
const { redirectIfAuthed } = require("../middleware/auth");
const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: "Too many login attempts." });
router.get("/login", redirectIfAuthed, (req, res) => {
  res.render("pages/login", { title: "Sign In", error: null, next: req.query.next || "/" });
});
router.post("/login", loginLimiter, redirectIfAuthed, (req, res) => {
  const next = String(req.body.next || "/");
  if (!verifyPassword(req.body.password)) {
    return res.render("pages/login", { title: "Sign In", error: "Incorrect password.", next });
  }
  createSessionCookie(res);
  res.redirect(next.startsWith("/") ? next : "/");
});
module.exports = router;
