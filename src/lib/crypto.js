const crypto = require("crypto");
const config = require("../config");
function getKey() {
  return crypto.createHash("sha256").update(config.appSecret).digest();
}
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}
function decrypt(payload) {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
function hashContent(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
module.exports = { encrypt, decrypt, hashContent };
