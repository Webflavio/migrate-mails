function formatAddressList(list) {
  if (!list || !list.length) return "";
  return list.map((item) => {
    if (item.address && item.name) return `${item.name} <${item.address}>`;
    return item.address || item.name || "";
  }).filter(Boolean).join(", ");
}
function hasAttachments(node) {
  if (!node) return false;
  if (node.disposition === "attachment") return true;
  if (node.childNodes && node.childNodes.length) {
    return node.childNodes.some(hasAttachments);
  }
  const type = String(node.type || "").toLowerCase();
  if (type.startsWith("multipart/")) return false;
  if (type.startsWith("text/")) return false;
  return Boolean(node.size && node.size > 0);
}
function metadataFromFetch(msg) {
  const env = msg.envelope || {};
  const subject = env.subject || "(no subject)";
  const from = formatAddressList(env.from);
  const to = formatAddressList(env.to);
  const cc = formatAddressList(env.cc);
  const bcc = formatAddressList(env.bcc);
  const dateSent = env.date ? new Date(env.date).toISOString() : null;
  const messageId = env.messageId || null;
  const sizeBytes = msg.size || (msg.source ? msg.source.length : 0);
  const attachmentFlag = hasAttachments(msg.bodyStructure) ? 1 : 0;
  const searchText = [subject, from, to, cc].join(" ").slice(0, 10000);
  return {
    from,
    to,
    cc,
    bcc,
    subject,
    dateSent,
    messageId,
    textPreview: subject.slice(0, 2000),
    htmlAvailable: 0,
    searchText,
    attachments: [],
    hasAttachments: attachmentFlag,
    sizeBytes,
  };
}
module.exports = { metadataFromFetch, formatAddressList, hasAttachments };
