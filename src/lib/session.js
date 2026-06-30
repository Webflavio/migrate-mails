const crypto = require("crypto");
const config = require("../config");
const COOKIE_NAME = "mv_session";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", config.appSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", config.appSecret).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (_) {
    return null;
  }
}
function createSessionCookie(res) {
  const token = sign({ auth: true, exp: Date.now() + MAX_AGE_MS });
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(MAX_AGE_MS / 1000)}`);
}
function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}
function parseCookies(req) {
  const header = req.headers.cookie || "";
  const cookies = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx > 0) cookies[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return cookies;
}
function getSession(req) {
  const cookies = parseCookies(req);
  return verify(cookies[COOKIE_NAME]);
}
function verifyPassword(input) {
  const expected = config.adminPassword;
  const a = Buffer.from(String(input || ""));
  const b = Buffer.from(String(expected || ""));
  if (!a.length || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
module.exports = { COOKIE_NAME, createSessionCookie, clearSessionCookie, getSession, verifyPassword };
