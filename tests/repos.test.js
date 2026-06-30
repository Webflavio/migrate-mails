const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
let tempDir;
before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mailvault-"));
  process.env.DB_PATH = path.join(tempDir, "test.db");
  process.env.STORAGE_PATH = path.join(tempDir, "storage");
  process.env.EXPORT_PATH = path.join(tempDir, "exports");
  process.env.APP_SECRET = "test-secret-key-123456";
process.env.ADMIN_PASSWORD = "testpass";
  delete require.cache[require.resolve("../src/config")];
  delete require.cache[require.resolve("../src/db/index")];
  const dbModule = require("../src/db/index");
  await dbModule.initDb();
});
after(() => {
  delete require.cache[require.resolve("../src/db/index")];
  const dbModule = require("../src/db/index");
  dbModule.closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
test("account repository creates and lists accounts", () => {
  delete require.cache[require.resolve("../src/repos/accounts")];
  const accountsRepo = require("../src/repos/accounts");
  const account = accountsRepo.createAccount({
    label: "Test",
    imap_host: "imap.example.com",
    imap_port: 993,
    imap_secure: true,
    username: "user@example.com",
    password: "secret",
  });
  assert.ok(account.id);
  const list = accountsRepo.listAccounts();
  assert.equal(list.length, 1);
  assert.equal(accountsRepo.getPassword(account), "secret");
});
