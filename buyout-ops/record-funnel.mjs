#!/usr/bin/env node
/**
 * Record funnel events on a lead row (reply / bounce / order / meeting / quote).
 *
 * Usage:
 *   node buyout-ops/record-funnel.mjs --company "村上工務店" --reply a_hope
 *   node buyout-ops/record-funnel.mjs --company "株式会社基工務店" --bounce mailbox_full
 *   node buyout-ops/record-funnel.mjs --company "…" --order 66000
 *   node buyout-ops/record-funnel.mjs --company "…" --opt-out
 *
 * reply types: a_hope | b_hope | question | custom | decline | opt_out | other
 * bounce types: hard | soft | mailbox_full
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";
import { jstDateString } from "./send-quota.mjs";
import { METRICS_COLUMNS } from "./metrics-columns.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const leadsPath = path.join(__dirname, "demo_buyout_leads.csv");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const company = arg("company");
if (!company) {
  console.error("Required: --company");
  process.exit(1);
}

const today = arg("date") || jstDateString();
const reply = arg("reply");
const bounce = arg("bounce");
const orderYen = arg("order");
const meeting = process.argv.includes("--meeting");
const quote = process.argv.includes("--quote");
const optOut = process.argv.includes("--opt-out");

const REPLY_OK = new Set(["a_hope", "b_hope", "buy", "question", "custom", "decline", "opt_out", "other"]);
const BOUNCE_OK = new Set(["hard", "soft", "mailbox_full"]);

if (reply && !REPLY_OK.has(reply)) {
  console.error(`FAIL reply must be one of ${[...REPLY_OK].join("|")}`);
  process.exit(1);
}
if (bounce && !BOUNCE_OK.has(bounce)) {
  console.error(`FAIL bounce must be one of ${[...BOUNCE_OK].join("|")}`);
  process.exit(1);
}

let { headers, rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
for (const col of METRICS_COLUMNS) {
  if (!headers.includes(col)) headers = [...headers, col];
}
const idx = rows.findIndex((r) => r.company === company);
if (idx < 0) {
  console.error(`FAIL company not found: ${company}`);
  process.exit(1);
}
const row = rows[idx];
for (const col of METRICS_COLUMNS) {
  if (row[col] == null) row[col] = "";
}

const noteBits = [];

if (reply) {
  row.reply_type = reply;
  row.reply_at = row.reply_at || today;
  row.reply_class = reply; // keep legacy column in sync
  noteBits.push(`reply=${reply} ${today}`);
}
if (optOut || reply === "opt_out") {
  row.do_not_contact = "true";
  row.status = row.status === "sent" || row.status === "queued" ? "paused" : row.status;
  row.reply_type = row.reply_type || "opt_out";
  row.reply_at = row.reply_at || today;
  noteBits.push(`opt_out ${today}`);
}
if (bounce) {
  row.bounce_type = bounce;
  row.bounce_at = row.bounce_at || today;
  row.status = "paused";
  noteBits.push(`bounce=${bounce} ${today}`);
}
if (meeting) {
  row.meeting_at = row.meeting_at || today;
  noteBits.push(`meeting ${today}`);
}
if (quote) {
  row.quote_at = row.quote_at || today;
  noteBits.push(`quote ${today}`);
}
if (orderYen) {
  const n = Number(String(orderYen).replace(/[,円]/g, ""));
  if (!Number.isFinite(n) || n <= 0) {
    console.error("FAIL --order must be a positive yen amount");
    process.exit(1);
  }
  row.order_amount_yen = String(n);
  row.order_at = row.order_at || today;
  noteBits.push(`order=${n} ${today}`);
}

if (!noteBits.length) {
  console.error("FAIL specify --reply / --bounce / --order / --meeting / --quote / --opt-out");
  process.exit(1);
}

const prefix = noteBits.join(" / ");
row.notes = row.notes ? `${row.notes} / ${prefix}` : prefix;
rows[idx] = row;
fs.writeFileSync(leadsPath, serializeCsv(headers, rows) + "\n");
console.log(`RESULT ok — ${company}: ${prefix}`);
