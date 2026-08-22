#!/usr/bin/env node
/**
 * Inbox gate: block wrong checkout/followup for legacy price cohort.
 * Exit 0 = ok to use template. Non-zero = do not send.
 *
 * Usage:
 *   node buyout-ops/verify-inbox-reply.mjs --company "株式会社福澤工務店" --template checkout
 *   node buyout-ops/verify-inbox-reply.mjs --email construction@k-fukuzawa.co.jp --template followup
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

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
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

const LEGACY_PRICE = "55000";
const BLOCKED_FOR_LEGACY = new Set(["checkout", "2_checkout", "followup", "5_followup"]);

const template = arg("template");
const company = arg("company");
const email = arg("email");

if (!template) {
  console.error("Required: --template checkout|followup|faq|custom|decline");
  process.exit(2);
}

const csvPath = path.join(__dirname, "demo_buyout_leads.csv");
const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
let row = null;
if (email) row = rows.find((r) => (r.email || "").toLowerCase() === email.toLowerCase());
if (!row && company) row = rows.find((r) => (r.company || "").includes(company));

if (!row) {
  console.error("FAIL I1 CSVに該当行がない");
  process.exit(1);
}

const quoted = String(row.quoted_price || "").trim();
const tplKey = template.replace(/^email_demo_buyout_/, "").replace(/\.txt$/, "");

console.log(`company: ${row.company}`);
console.log(`quoted_price: ${quoted || "(empty)"}`);
console.log(`template: ${template}`);

if (quoted === LEGACY_PRICE && BLOCKED_FOR_LEGACY.has(tplKey)) {
  console.error(
    `FAIL I2 旧価格コホート — ${template} 禁止（66k決済/フォローは送らない。オーナーが55kで対応）`
  );
  process.exit(1);
}

if (tplKey === "checkout" || template === "checkout") {
  const checkoutTpl = path.join(__dirname, "templates", "email_demo_buyout_2_checkout.txt");
  if (fs.existsSync(checkoutTpl)) {
    const body = fs.readFileSync(checkoutTpl, "utf8");
    if (/55,000|50,000/.test(body.split("\n\n").slice(1).join("\n\n"))) {
      console.error("FAIL I3 checkoutテンプレに旧価格が残っている");
      process.exit(1);
    }
    if (!/66,000|66000/.test(body)) {
      console.error("FAIL I3 checkoutテンプレに66,000がない");
      process.exit(1);
    }
  }
}

console.log("RESULT PASS — ok to use this template");
process.exit(0);
