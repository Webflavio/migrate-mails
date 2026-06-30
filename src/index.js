const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
const config = require("./config");
const { initDb } = require("./db");
const { formatBytes } = require("./lib/formatBytes");
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
const startup = { ready: false, error: null };
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
function mountAppRoutes(app) {
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  const publicDir = path.join(__dirname, "..", "public");
  const staticOpts = { maxAge: config.isProduction ? "7d" : 0 };
  app.use(`${config.basePath}/assets`, express.static(publicDir, staticOpts));
  app.get([`${config.basePath}/assets/css/app.css`, `${config.basePath}/public/css/app.css`], (req, res) => {
    res.type("text/css");
    res.sendFile(path.join(publicDir, "css", "app.css"));
  });
  app.use(`${config.basePath}/public`, express.static(publicDir, staticOpts));
  app.use(rateLimit({ windowMs: 60 * 1000, max: 200 }));
  app.locals.formatDate = (value) => {
    if (!value) return "—";
    return new Date(value).toLocaleString();
  };
  app.locals.statusClass = (status) => {
    const map = { connected: "ok", completed: "ok", running: "run", pending: "run", failed: "bad", error: "bad", completed_with_errors: "warn", cancelled: "warn" };
    return map[status] || "neutral";
  };
  app.locals.formatBytes = formatBytes;
  app.locals.asset = (file) => `${config.basePath}/assets/${String(file || "").replace(/^\/+/, "")}`;
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
}
async function main() {
  console.log("[startup] Ensuring data directories...");
  ensureAppDirs();
  console.log("[startup] Data root:", config.dataRoot || config.storagePath);
  const { mysqlStartupHint, redactMysqlUrl } = require("./lib/mysqlConfig");
  console.log("[startup] MySQL URL:", redactMysqlUrl(config.mysqlUrl));
  console.log("[startup] MySQL target:", `${config.mysql.host}:${config.mysql.port}/${config.mysql.database} (user: ${config.mysql.user})`);
  console.log(mysqlStartupHint(config.mysql));
  console.log("[startup] Storage:", config.storagePath);
  console.log("[startup] Creating Express app...");
  const app = express();
  app.set("trust proxy", config.trustProxy);
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.get("/health", (req, res) => {
    if (startup.error) {
      res.status(503).json({ ok: false, service: "email-backup-manager", status: "error", error: startup.error.message });
      return;
    }
    if (!startup.ready) {
      res.status(200).json({ ok: true, service: "email-backup-manager", status: "starting" });
      return;
    }
    res.status(200).json({ ok: true, service: "email-backup-manager", status: "ready" });
  });
  app.use((req, res, next) => {
    if (req.path === "/health") return next();
    if (startup.error) {
      res.status(503).type("text").send("Application failed to start. Check server logs.");
      return;
    }
    if (!startup.ready) {
      res.status(503).type("text").send("Application is starting, please retry in a few seconds.");
      return;
    }
    next();
  });
  console.log("[startup] Starting HTTP server...");
  startListening(app);
  console.log("[startup] Initializing database...");
  await initDb();
  const { getRuntimeSettings } = require("./lib/runtimeConfig");
  await getRuntimeSettings();
  console.log("[startup] Database ready, mounting routes...");
  mountAppRoutes(app);
  try {
    exportService.cleanupOldExports();
  } catch (err) {
    console.warn("[startup] Export cleanup skipped:", err.message);
  }
  startJobRunner(2000);
  startup.ready = true;
  console.log("[startup] Application ready");
}
main().catch((err) => {
  startup.error = err;
  console.error("[startup] Failed to start application:", err);
  process.exit(1);
});
