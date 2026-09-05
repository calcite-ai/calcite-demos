/** Plain outreach body → HTML multipart (SendGrid: demo tracked, signature Web not). */

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function htmlLink(href, label, { track = true } = {}) {
  const off = track ? "" : " clicktracking=off";
  return `<a${off} href="${escapeAttr(href)}">${escapeHtml(label)}</a>`;
}

/**
 * @param {string} body plain text (signature Web: は通常URLのまま)
 * @param {{ urlA: string, urlB: string, calciteSite: string }} links
 */
export function outreachBodyToHtml(body, { urlA, urlB, calciteSite }) {
  let html = escapeHtml(body);
  for (const url of [urlA, urlB].filter(Boolean)) {
    const e = escapeHtml(url);
    html = html.split(e).join(htmlLink(url, url, { track: true }));
  }
  const webPlain = `Web：${escapeHtml(calciteSite)}`;
  const webHtml = `Web：${htmlLink(calciteSite, calciteSite, { track: false })}`;
  html = html.replace(webPlain, webHtml);
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #222;">
<div style="white-space: pre-wrap;">${html}</div>
</body>
</html>`;
}
