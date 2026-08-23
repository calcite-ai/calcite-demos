/** Shared CSV parse/serialize for buyout-ops (RFC4180-ish). */
export function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = [];
  let cur = "";
  let inQ = false;
  for (const c of lines[0]) {
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === "," && !inQ) {
      headers.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  headers.push(cur);
  const rows = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = [];
    cur = "";
    inQ = false;
    for (const c of lines[li]) {
      if (c === '"') {
        inQ = !inQ;
        continue;
      }
      if (c === "," && !inQ) {
        cols.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    cols.push(cur);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    rows.push(obj);
  }
  return { headers, rows };
}

export function serializeCsv(headers, rows, opts = {}) {
  const alwaysQuote = new Set(opts.alwaysQuoteHeaders || []);
  const esc = (v, h) => {
    const s = String(v ?? "");
    const looksLikeUrl = /^https?:\/\//i.test(s);
    if (
      alwaysQuote.has(h) ||
      looksLikeUrl ||
      s.includes(",") ||
      s.includes('"') ||
      s.includes("\n")
    ) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h], h)).join(","))].join(
    "\n"
  );
}

export function approvalRank(row) {
  const n = Number(String(row.approval_seq || "").trim());
  return Number.isFinite(n) && n > 0 ? n : 999999;
}

export function sortByApprovalSeq(rows) {
  return [...rows].sort((a, b) => approvalRank(a) - approvalRank(b));
}
