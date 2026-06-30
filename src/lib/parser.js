const { simpleParser } = require("mailparser");
async function parseMessage(buffer) {
  const parsed = await simpleParser(buffer);
  const from = parsed.from ? parsed.from.text : "";
  const to = parsed.to ? parsed.to.text : "";
  const cc = parsed.cc ? parsed.cc.text : "";
  const bcc = parsed.bcc ? parsed.bcc.text : "";
  const subject = parsed.subject || "(no subject)";
  const dateSent = parsed.date ? parsed.date.toISOString() : null;
  const messageId = parsed.messageId || null;
  const textPreview = parsed.text ? parsed.text.slice(0, 2000) : "";
  const htmlAvailable = parsed.html ? 1 : 0;
  const searchText = [subject, from, to, parsed.text || "", parsed.html ? parsed.html.replace(/<[^>]+>/g, " ") : ""].join(" ").slice(0, 10000);
  const attachments = (parsed.attachments || []).map((item) => ({
    filename: item.filename || "attachment",
    contentType: item.contentType || "application/octet-stream",
    sizeBytes: item.size || (item.content ? item.content.length : 0),
  }));
  return { from, to, cc, bcc, subject, dateSent, messageId, textPreview, htmlAvailable, searchText, attachments };
}
module.exports = { parseMessage };
