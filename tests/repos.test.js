const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
let tempDir;
let skipRepos = false;
before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mailvault-"));
  process.env.MYSQL_DATABASE = process.env.MYSQL_DATABASE || `mailvault_test_${Date.now()}`;
  process.env.STORAGE_PATH = path.join(tempDir, "storage");
  process.env.EXPORT_PATH = path.join(tempDir, "exports");
  process.env.APP_SECRET = "test-secret-key-123456";
  process.env.ADMIN_PASSWORD = "testpass";
  if (!process.env.MYSQL_HOST) process.env.MYSQL_HOST = "127.0.0.1";
  if (!process.env.MYSQL_USER) process.env.MYSQL_USER = "root";
  delete require.cache[require.resolve("../src/config")];
  delete require.cache[require.resolve("../src/db/index")];
  const dbModule = require("../src/db/index");
  try {
    await dbModule.initDb();
  } catch (err) {
    if (["ECONNREFUSED", "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR", "PROTOCOL_CONNECTION_LOST"].includes(err.code)) {
      skipRepos = true;
      return;
    }
    throw err;
  }
});
after(async () => {
  if (skipRepos) {
    if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    return;
  }
  delete require.cache[require.resolve("../src/db/index")];
  const dbModule = require("../src/db/index");
  try {
    await dbModule.closeDb();
  } catch (_) {}
  if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
});
test("account repository creates and lists accounts", async (t) => {
  if (skipRepos) return t.skip("MySQL not available for repository tests");
  delete require.cache[require.resolve("../src/repos/accounts")];
  const accountsRepo = require("../src/repos/accounts");
  const account = await accountsRepo.createAccount({
    label: "Test",
    imap_host: "imap.example.com",
    imap_port: 993,
    imap_secure: true,
    username: "user@example.com",
    password: "secret",
  });
  assert.ok(account.id);
  const list = await accountsRepo.listAccounts();
  assert.equal(list.length, 1);
  assert.equal(accountsRepo.getPassword(account), "secret");
});
