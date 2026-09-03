#!/usr/bin/env node
/**
 * Prior demo/outreach blocklist — do not send buyout mail again.
 * Source: prior_outreach_blocklist.csv (Gmail hello@ + kenta.hino1106@gmail.com 実績)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOCKLIST_PATH = path.join(__dirname, "prior_outreach_blocklist.csv");

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
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
    headers.forEach((h, i) => {
      obj[h] = cols[i] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

let cache = null;

export function loadPriorOutreachBlocklist() {
  if (cache) return cache;
  if (!fs.existsSync(BLOCKLIST_PATH)) {
    cache = [];
    return cache;
  }
  cache = parseCsv(fs.readFileSync(BLOCKLIST_PATH, "utf8"));
  return cache;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeCompany(name) {
  return String(name || "")
    .trim()
    .replace(/株式会社|有限会社|\(|\)|（|）/g, "")
    .replace(/\s+/g, "");
}

export function matchPriorOutreach({ company = "", email = "" } = {}) {
  const list = loadPriorOutreachBlocklist();
  const em = normalizeEmail(email);
  const co = normalizeCompany(company);

  for (const row of list) {
    const rowEm = normalizeEmail(row.email);
    if (em && rowEm && em === rowEm) {
      return { blocked: true, row, reason: `email ${row.email}` };
    }
    const rowCo = normalizeCompany(row.company);
    if (co && rowCo && (co === rowCo || co.includes(rowCo) || rowCo.includes(co))) {
      return { blocked: true, row, reason: `company ${row.company}` };
    }
  }
  return { blocked: false };
}

export function isPriorOutreachBlocked(target) {
  return matchPriorOutreach(target).blocked;
}

/** Append a blocklist row if email/company not already blocked. Returns true if appended. */
export function appendPriorOutreachBlocklist({
  company = "",
  email = "",
  vertical = "koumuten",
  sent_via = "hello@calcite-mail.jp",
  sent_date = "",
  notes = "",
} = {}) {
  if (isPriorOutreachBlocked({ company, email })) return false;
  const headers = "company,email,vertical,sent_via,sent_date,notes";
  const escape = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const line = [company, email, vertical, sent_via, sent_date, notes].map(escape).join(",");
  let prev = "";
  if (fs.existsSync(BLOCKLIST_PATH)) {
    prev = fs.readFileSync(BLOCKLIST_PATH, "utf8");
    if (!prev.endsWith("\n")) prev += "\n";
    if (!prev.trim()) prev = `${headers}\n`;
  } else {
    prev = `${headers}\n`;
  }
  fs.writeFileSync(BLOCKLIST_PATH, prev + line + "\n");
  cache = null;
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const company = process.argv.includes("--company")
    ? process.argv[process.argv.indexOf("--company") + 1]
    : "";
  const email = process.argv.includes("--email")
    ? process.argv[process.argv.indexOf("--email") + 1]
    : "";
  const m = matchPriorOutreach({ company, email });
  if (m.blocked) {
    console.log(`BLOCKED (${m.reason}) — ${m.row.company} / ${m.row.sent_via} ${m.row.sent_date}`);
    console.log(m.row.notes || "");
    process.exit(1);
  }
  console.log("OK — not on prior outreach blocklist");
  process.exit(0);
}
