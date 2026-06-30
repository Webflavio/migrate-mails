const path = require("path");
const { z } = require("zod");
const { parseBool } = require("./lib/parseBool");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const schema = z.object({
  PORT: z.coerce.number().default(3847),
  APP_SECRET: z.string().min(16).default("change-me-in-production-key"),
  DB_PATH: z.string().default("./data/app.db"),
  STORAGE_PATH: z.string().default("./storage/emails"),
  EXPORT_PATH: z.string().default("./exports"),
  LEGACY_BACKUP_PATH: z.string().default("./backup"),
  MAX_MESSAGE_MB: z.coerce.number().default(50),
  JOB_CONCURRENCY: z.coerce.number().default(1),
  EXPORT_RETENTION_DAYS: z.coerce.number().default(7),
  IMAP_TIMEOUT_MS: z.coerce.number().default(120000),
  IMAP_TLS_INSECURE: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  NODE_ENV: z.string().optional(),
  ADMIN_PASSWORD: z.string().min(4).default("changeme"),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const root = path.join(__dirname, "..");
const config = {
  port: parsed.data.PORT,
  appSecret: parsed.data.APP_SECRET,
  dbPath: path.resolve(root, parsed.data.DB_PATH),
  storagePath: path.resolve(root, parsed.data.STORAGE_PATH),
  exportPath: path.resolve(root, parsed.data.EXPORT_PATH),
  legacyBackupPath: path.resolve(root, parsed.data.LEGACY_BACKUP_PATH),
  maxMessageBytes: parsed.data.MAX_MESSAGE_MB * 1024 * 1024,
  jobConcurrency: parsed.data.JOB_CONCURRENCY,
  exportRetentionDays: parsed.data.EXPORT_RETENTION_DAYS,
  imapTimeoutMs: parsed.data.IMAP_TIMEOUT_MS,
  imapTlsInsecure: parseBool(parsed.data.IMAP_TLS_INSECURE, false),
  trustProxy: parsed.data.TRUST_PROXY === "false" || parsed.data.TRUST_PROXY === "0"
    ? false
    : parsed.data.TRUST_PROXY === "true" ? true : Number(parsed.data.TRUST_PROXY || 1),
  isProduction: parsed.data.NODE_ENV === "production",
  adminPassword: parsed.data.ADMIN_PASSWORD,
  root,
};
module.exports = config;
