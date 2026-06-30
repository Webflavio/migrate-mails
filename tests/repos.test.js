const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
let tempDir;
let skipRepos = false;
before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mailvault-"));
  const dbName = `mailvault_test_${Date.now()}`;
  if (!process.env.MYSQL_URL) {
    process.env.MYSQL_URL = `mysql://root@localhost:3306/${dbName}`;
  }
  process.env.STORAGE_PATH = path.join(tempDir, "storage");
  process.env.EXPORT_PATH = path.join(tempDir, "exports");
  process.env.APP_SECRET = "test-secret-key-123456";
  process.env.ADMIN_PASSWORD = "testpass";
  delete require.cache[require.resolve("../src/config")];
  delete require.cache[require.resolve("../src/lib/mysqlConfig")];
  delete require.cache[require.resolve("../src/db/index")];
  const dbModule = require("../src/db/index");
  try {
    await dbModule.initDb();
  } catch (err) {
    if (["ECONNREFUSED", "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR", "PROTOCOL_CONNECTION_LOST"].includes(err.code)) {
      skipRepos = true;
      return;
    }
    if (/Could not connect to MySQL|Invalid MYSQL_URL|MySQL configuration incomplete/.test(err.message || "")) {
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
