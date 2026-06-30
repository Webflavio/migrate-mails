const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
const config = require("./config");
const { initDb } = require("./db");
const errorHandler = require("./middleware/errorHandler");
const { startJobRunner } = require("./services/jobRunner");
const exportService = require("./services/export");
const dashboardRoutes = require("./routes/dashboard");
const accountsRoutes = require("./routes/accounts");
const browseRoutes = require("./routes/browse");
const exportRoutes = require("./routes/export");
const migrateRoutes = require("./routes/migrate");
const jobsRoutes = require("./routes/jobs");
const settingsRoutes = require("./routes/settings");
const backupsRoutes = require("./routes/backups");
const authRoutes = require("./routes/auth");
const { requireAuth } = require("./middleware/auth");
const { clearSessionCookie } = require("./lib/session");
async function main() {
  await initDb();
  const app = express();
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use("/public", express.static(path.join(__dirname, "..", "public")));
  app.use(rateLimit({ windowMs: 60 * 1000, max: 200 }));
  app.locals.formatDate = (value) => {
    if (!value) return "—";
    return new Date(value).toLocaleString();
  };
  app.locals.statusClass = (status) => {
    const map = { connected: "ok", completed: "ok", running: "run", pending: "run", failed: "bad", error: "bad", completed_with_errors: "warn" };
    return map[status] || "neutral";
  };
  app.use("/", authRoutes);
  app.all("/logout", (req, res) => {
    clearSessionCookie(res);
    res.redirect("/login");
  });
  app.use(requireAuth);
  app.use("/", dashboardRoutes);
  app.use("/accounts", accountsRoutes);
  app.use("/browse", browseRoutes);
  app.use("/export", exportRoutes);
  app.use("/migrate", migrateRoutes);
  app.use("/jobs", jobsRoutes);
  app.use("/settings", settingsRoutes);
  app.use("/backups", backupsRoutes);
  app.use(errorHandler);
  exportService.cleanupOldExports();
  startJobRunner(2000);
  app.listen(config.port, () => {
    console.log(`Email Backup Manager running at http://localhost:${config.port}`);
  });
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
