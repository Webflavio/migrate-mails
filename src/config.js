const path = require("path");
const { z } = require("zod");
const { parseBool } = require("./lib/parseBool");
const { resolveDataPath } = require("./lib/paths");
const envPath = path.join(__dirname, "..", ".env");
const platformPort = process.env.PORT;
const platformNodeEnv = process.env.NODE_ENV;
require("dotenv").config({ path: envPath });
if (platformPort) process.env.PORT = platformPort;
if (platformNodeEnv) process.env.NODE_ENV = platformNodeEnv;
const schema = z.object({
  PORT: z.coerce.number().optional(),
  HOST: z.string().default("0.0.0.0"),
  DATA_DIR: z.string().optional(),
  APP_SECRET: z.string().min(16).default("change-me-in-production-key"),
  MYSQL_HOST: z.string().default("localhost"),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_USER: z.string().default("root"),
  MYSQL_PASSWORD: z.string().default(""),
  MYSQL_DATABASE: z.string().min(1).default("mailvault"),
  MYSQL_SOCKET: z.string().optional(),
  STORAGE_PATH: z.string().optional(),
  EXPORT_PATH: z.string().optional(),
  LEGACY_BACKUP_PATH: z.string().default("./backup"),
  MAX_MESSAGE_MB: z.coerce.number().default(50),
  JOB_CONCURRENCY: z.coerce.number().default(1),
  EXPORT_RETENTION_DAYS: z.coerce.number().default(7),
  IMAP_TIMEOUT_MS: z.coerce.number().default(120000),
  IMAP_TLS_INSECURE: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  BASE_PATH: z.string().optional(),
  NODE_ENV: z.string().optional(),
  ADMIN_PASSWORD: z.string().min(4).default("changeme"),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const root = path.join(__dirname, "..");
const isProduction = parsed.data.NODE_ENV === "production";
const isHosted = Boolean(platformPort) || isProduction;
function getDataRoot() {
  if (parsed.data.DATA_DIR) {
    return path.isAbsolute(parsed.data.DATA_DIR)
      ? parsed.data.DATA_DIR
      : path.resolve(root, parsed.data.DATA_DIR);
  }
  if (isHosted) return path.resolve(root, "..", "mailvault-data");
  return null;
}
const dataRoot = getDataRoot();
const pathOpts = { root, dataRoot };
const config = {
  port: parsed.data.PORT || 3847,
  host: parsed.data.HOST,
  dataRoot,
  appSecret: parsed.data.APP_SECRET,
  mysql: {
    host: parsed.data.MYSQL_HOST,
    port: parsed.data.MYSQL_PORT,
    user: parsed.data.MYSQL_USER,
    password: parsed.data.MYSQL_PASSWORD,
    database: parsed.data.MYSQL_DATABASE,
    socketPath: parsed.data.MYSQL_SOCKET || undefined,
  },
  storagePath: resolveDataPath({ ...pathOpts, setting: parsed.data.STORAGE_PATH, defaultRel: "./storage/emails", leaf: "emails" }),
  exportPath: resolveDataPath({ ...pathOpts, setting: parsed.data.EXPORT_PATH, defaultRel: "./exports", leaf: "exports" }),
  legacyBackupPath: path.isAbsolute(parsed.data.LEGACY_BACKUP_PATH)
    ? parsed.data.LEGACY_BACKUP_PATH
    : path.resolve(root, parsed.data.LEGACY_BACKUP_PATH),
  maxMessageBytes: parsed.data.MAX_MESSAGE_MB * 1024 * 1024,
  jobConcurrency: parsed.data.JOB_CONCURRENCY,
  exportRetentionDays: parsed.data.EXPORT_RETENTION_DAYS,
  imapTimeoutMs: parsed.data.IMAP_TIMEOUT_MS,
  imapTlsInsecure: parseBool(parsed.data.IMAP_TLS_INSECURE, false),
  trustProxy: parsed.data.TRUST_PROXY === "false" || parsed.data.TRUST_PROXY === "0"
    ? false
    : parsed.data.TRUST_PROXY === "true" ? true : Number(parsed.data.TRUST_PROXY || 1),
  isProduction: parsed.data.NODE_ENV === "production",
  isHosted,
  adminPassword: parsed.data.ADMIN_PASSWORD,
  basePath: (parsed.data.BASE_PATH || "").replace(/\/+$/, ""),
  root,
};
module.exports = config;
