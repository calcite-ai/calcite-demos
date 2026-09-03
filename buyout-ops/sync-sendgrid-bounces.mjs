#!/usr/bin/env node
/**
 * SendGrid のバウンス抑制リストをリードCSVに反映する。
 *
 * SendGrid 経由の送信では DSN が SendGrid の return-path に返るため、
 * IMAP を見る inbox-process.mjs ではバウンスを取りこぼす。
 * 由来: 2026-09-03 黒田工務店が 550 5.1.1 User Unknown で即バウンスしたが
 *       ConoHa 受信箱には DSN が来ず、CSV が sent のままだった。
 *
 * Env: SENDGRID_API_KEY
 *
 * Usage:
 *   node buyout-ops/sync-sendgrid-bounces.mjs --dry-run
 *   node buyout-ops/sync-sendgrid-bounces.mjs --days 30
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";
import { jstDateString } from "./send-quota.mjs";
import { classifyBounceText } from "./smtp-error-kind.mjs";
import { appendPriorOutreachBlocklist } from "./prior-outreach.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buyoutPath = path.join(__dirname, "demo_buyout_leads.csv");
const insidePath = path.join(__dirname, "inside_sales_poc_leads.csv");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const dryRun = process.argv.includes("--dry-run");
const days = Number(arg("days", "14"));

const apiKey = process.env.SENDGRID_API_KEY;
if (!apiKey) {
  console.error("FAIL missing SENDGRID_API_KEY");
  process.exit(1);
}

const startTime = Math.floor(Date.now() / 1000) - days * 86400;
const res = await fetch(
  `https://api.sendgrid.com/v3/suppression/bounces?start_time=${startTime}`,
  { headers: { Authorization: `Bearer ${apiKey}` } }
);
if (!res.ok) {
  console.error(`FAIL SendGrid bounces ${res.status} ${await res.text()}`);
  process.exit(1);
}
const bounces = await res.json();

const tracks = [
  { name: "buyout", file: buyoutPath, quote: undefined },
  {
    name: "inside",
    file: insidePath,
    quote: ["site_url", "email", "campaign_evidence", "notes"],
  },
];

for (const t of tracks) {
  const parsed = parseCsv(fs.readFileSync(t.file, "utf8"));
  t.headers = parsed.headers;
  t.rows = parsed.rows;
  t.byEmail = new Map();
  for (const r of t.rows) {
    const e = String(r.email || "").trim().toLowerCase();
    if (e) t.byEmail.set(e, r);
  }
  t.touched = false;
}

const actions = [];
const unmatched = [];
const skippedFields = [];

/** serializeCsv は headers に無い列を黙って捨てるので、無い列は警告して残す */
function setField(track, row, key, value) {
  if (!track.headers.includes(key)) {
    skippedFields.push(`${track.name}.${key}`);
    return;
  }
  row[key] = value;
}

for (const b of bounces) {
  const email = String(b.email || "").trim().toLowerCase();
  if (!email) continue;
  const track = tracks.find((t) => t.byEmail.has(email));
  if (!track) {
    unmatched.push(email);
    continue;
  }
  const row = track.byEmail.get(email);
  const kind = classifyBounceText(`${b.status || ""} ${b.reason || ""}`);
  if (row.bounce_at || row.status === "paused" || row.status === "opt_out") {
    actions.push({ type: "already", track: track.name, company: row.company, email, kind });
    continue;
  }
  setField(track, row, "bounce_at", jstDateString());
  setField(track, row, "bounce_type", kind);
  setField(track, row, "status", track.name === "inside" ? "opt_out" : "paused");
  setField(
    track,
    row,
    "notes",
    `${row.notes || ""} / SendGrid bounce ${jstDateString()} kind=${kind} ${String(
      b.reason || ""
    ).slice(0, 80)}`.trim()
  );
  track.touched = true;
  actions.push({ type: "bounce", track: track.name, company: row.company, email, kind });
  if (track.name === "inside" && !dryRun) {
    appendPriorOutreachBlocklist({
      company: row.company,
      email,
      sent_date: jstDateString(),
      notes: `SendGrid bounce ${kind}`,
    });
  }
}

if (!dryRun) {
  for (const t of tracks) {
    if (!t.touched) continue;
    fs.writeFileSync(
      t.file,
      serializeCsv(t.headers, t.rows, t.quote ? { alwaysQuoteHeaders: t.quote } : {}) + "\n"
    );
  }
}

console.log(
  JSON.stringify(
    { dryRun, days, bounces: bounces.length, actions, unmatched, skippedFields: [...new Set(skippedFields)] },
    null,
    2
  )
);
console.log(
  `RESULT ok — bounces=${bounces.length} applied=${
    actions.filter((a) => a.type === "bounce").length
  } already=${actions.filter((a) => a.type === "already").length} unmatched=${unmatched.length}`
);
