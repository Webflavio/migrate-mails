const { getSession } = require("../lib/session");
function requireAuth(req, res, next) {
  if (getSession(req)) return next();
  if (req.method === "GET" && !req.xhr && !(req.headers.accept || "").includes("json")) {
    return res.redirect("/login?next=" + encodeURIComponent(req.originalUrl || "/"));
  }
  return res.status(401).json({ error: "Unauthorized" });
}
function redirectIfAuthed(req, res, next) {
  if (getSession(req)) return res.redirect("/");
  next();
}
module.exports = { requireAuth, redirectIfAuthed };
