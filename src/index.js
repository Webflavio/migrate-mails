const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
const config = require("./config");
const { initDb } = require("./db");
const { ensureAppDirs } = require("./lib/ensureDirs");
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
function startListening(app) {
  if (typeof PhusionPassenger !== "undefined") {
    app.listen("passenger", () => {
      console.log("Email Backup Manager ready (Phusion Passenger)");
    });
    return;
  }
  app.listen(config.port, config.host, () => {
    console.log(`Email Backup Manager listening on ${config.host}:${config.port}`);
  });
}
async function main() {
  console.log("[startup] Ensuring data directories...");
  ensureAppDirs();
  console.log("[startup] Initializing database...");
  await initDb();
  console.log("[startup] Creating Express app...");
  const app = express();
  app.set("trust proxy", config.trustProxy);
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.get("/health", (req, res) => {
    res.status(200).json({ ok: true, service: "email-backup-manager" });
  });
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
  try {
    exportService.cleanupOldExports();
  } catch (err) {
    console.warn("[startup] Export cleanup skipped:", err.message);
  }
  startJobRunner(2000);
  console.log("[startup] Starting HTTP server...");
  startListening(app);
}
main().catch((err) => {
  console.error("[startup] Failed to start application:", err);
  process.exit(1);
});
