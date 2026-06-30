const { test } = require("node:test");
const assert = require("node:assert/strict");
const { safeName, uniqueName } = require("../src/lib/safeName");
const { hashContent } = require("../src/lib/crypto");
test("safeName sanitizes invalid characters", () => {
  assert.equal(safeName("Folder/Name<>"), "Folder_Name_");
  assert.equal(safeName(""), "INBOX");
});
test("uniqueName avoids duplicates", () => {
  const used = new Set(["inbox"]);
  assert.equal(uniqueName("INBOX", used), "INBOX_2");
});
test("hashContent is stable", () => {
  const a = hashContent(Buffer.from("hello"));
  const b = hashContent(Buffer.from("hello"));
  assert.equal(a, b);
  assert.notEqual(a, hashContent(Buffer.from("world")));
});
