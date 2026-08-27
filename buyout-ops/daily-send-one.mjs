#!/usr/bin/env node
/**
 * Daily buyout send (GitHub Actions 10:00 JST) with same-day failover.
 *
 * - Fills remaining quota (send-quota.csv) with successful sends
 * - On recipient SMTP reject → pause lead, try next company
 * - On verify skip / transient → try next (leave row sendable)
 * - On spam / auth / unknown → STOP (do not keep blasting)
 * - Attempt cap: remaining + 2 (max 5) so one bad morning cannot burn the list
 *
 * Usage:
 *   node buyout-ops/daily-send-one.mjs
 *   node buyout-ops/daily-send-one.mjs --dry-run
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";
import { jstDateString, loadSendQuota } from "./send-quota.mjs";
import { SMTP_EXIT } from "./smtp-error-kind.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const leadsPath = path.join(__dirname, "demo_buyout_leads.csv");
const escalatePath = path.join(__dirname, "metrics/inbox-escalate.md");
const dryRun = process.argv.includes("--dry-run");

const METRIC_COLS = [
  "sent_at",
  "bounce_at",
  "bounce_type",
  "reply_at",
  "reply_type",
  "meeting_at",
  "quote_at",
  "order_at",
  "order_amount_yen",
  "template_version",
];

function runCapture(args) {
  const r = spawnSync(process.execPath, args, {
    encoding: "utf8",
    cwd: root,
    env: process.env,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r;
}

function queueStatus() {
  const statusProc = spawnSync(
    process.execPath,
    [path.join(__dirname, "queue-status.mjs"), "--json"],
    { encoding: "utf8", cwd: root }
  );
  if (statusProc.stderr) process.stderr.write(statusProc.stderr);
  try {
    return JSON.parse(statusProc.stdout || "");
  } catch {
    console.error("FAIL queue-status JSON parse");
    process.exit(1);
  }
}

function appendEscalate(block) {
  fs.mkdirSync(path.dirname(escalatePath), { recursive: true });
  const prev = fs.existsSync(escalatePath) ? fs.readFileSync(escalatePath, "utf8") : "# Inbox escalate\n\n";
  fs.writeFileSync(escalatePath, prev + block);
}

function ensureCols(headers, row) {
  let hdrs = headers;
  for (const col of METRIC_COLS) {
    if (!hdrs.includes(col)) hdrs = [...hdrs, col];
    if (row[col] == null) row[col] = "";
  }
  return hdrs;
}

function markPaused(company, reason) {
  const { headers, rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
  const idx = rows.findIndex((r) => r.company === company);
  if (idx < 0) return;
  const today = jstDateString();
  let hdrs = ensureCols(headers, rows[idx]);
  rows[idx].status = "paused";
  rows[idx].notes = `${rows[idx].notes || ""} / send_fail ${today} ${reason}`.trim();
  fs.writeFileSync(leadsPath, serializeCsv(hdrs, rows) + "\n");
  console.log(`RESULT paused (no retry): ${company} — ${reason}`);
}

function markSent(company, messageId) {
  const { headers, rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
  const idx = rows.findIndex((r) => r.company === company);
  if (idx < 0) {
    console.error("FAIL company missing after send");
    process.exit(1);
  }
  const today = jstDateString();
  let hdrs = ensureCols(headers, rows[idx]);
  rows[idx].status = "sent";
  rows[idx].sent_at = today;
  rows[idx].template_version = rows[idx].template_version || "v1_initial_66k";
  rows[idx].notes = `初回送信済 ${today} / SMTP ${messageId} / GitHub Actions daily-send`;
  fs.writeFileSync(leadsPath, serializeCsv(hdrs, rows) + "\n");
  console.log(`RESULT marked sent: ${company}`);
}

function maxAttempts(remaining) {
  // Cap so spam/misc failures cannot walk the whole approved list in one run.
  return Math.min(5, Math.max(1, remaining) + 2);
}

let status = queueStatus();
if (status.remaining_today <= 0) {
  console.log("RESULT skip — remaining_today=0");
  process.exit(0);
}
if (!status.next?.company) {
  console.log("RESULT skip — no sendable (9:00 refill may have failed)");
  process.exit(0);
}

const need = status.remaining_today;
const attemptCap = maxAttempts(need);
let successes = 0;
let attempts = 0;
const tried = new Set();

console.log(
  `\n=== daily send start remaining=${need} attempt_cap=${attemptCap} dryRun=${dryRun} ===`
);

if (runCapture([path.join(__dirname, "verify-ops-pack.mjs")]).status !== 0) {
  process.exit(1);
}

while (successes < need && attempts < attemptCap) {
  status = queueStatus();
  if (status.remaining_today <= 0) {
    console.log("RESULT done — remaining_today=0");
    break;
  }
  const candidates = status.failover_candidates?.length
    ? status.failover_candidates
    : status.next_sends || [];
  const pick = candidates.find((c) => c.company && !tried.has(c.company));
  const company = pick?.company;
  if (!company) {
    console.log("RESULT stop — no more sendable candidates");
    break;
  }
  tried.add(company);
  attempts += 1;
  console.log(`\n=== attempt ${attempts}/${attemptCap}: ${company} (need ${need - successes} more) ===`);

  const g1 = runCapture([
    path.join(__dirname, "verify-hunter-g1.mjs"),
    "--from-csv",
    "--company",
    company,
  ]);
  if (g1.status !== 0) {
    console.log(`SKIP verify-hunter-g1 FAIL — try next (${company} stays sendable)`);
    continue;
  }
  const v = runCapture([
    path.join(__dirname, "verify-before-send.mjs"),
    "--from-csv",
    "--company",
    company,
  ]);
  if (v.status !== 0) {
    console.log(`SKIP verify-before-send FAIL — try next (${company} stays sendable)`);
    continue;
  }

  const sendArgs = [path.join(__dirname, "send-outreach-smtp.mjs"), "--company", company];
  if (dryRun) sendArgs.push("--dry-run");
  const send = runCapture(sendArgs);
  const code = send.status ?? 1;

  if (dryRun) {
    if (code === 0) {
      successes += 1;
      console.log(`RESULT dry-run would send: ${company}`);
    } else {
      console.log(`RESULT dry-run send script exit=${code} — stop`);
      process.exit(code || 1);
    }
    continue;
  }

  if (code === 0) {
    const idMatch = (send.stdout || "").match(/SMTP_MESSAGE_ID=(.+)/);
    const messageId = (idMatch?.[1] || "").trim() || "unknown";
    markSent(company, messageId);
    successes += 1;
    continue;
  }

  if (code === SMTP_EXIT.recipient) {
    markPaused(company, "smtp_recipient");
    console.log("FAILOVER — recipient reject, try next company");
    continue;
  }

  if (code === SMTP_EXIT.transient) {
    console.log(`SKIP transient SMTP — try next (${company} stays sendable)`);
    continue;
  }

  // spam / auth / geo / unknown → stop (never walk the list)
  const kind =
    code === SMTP_EXIT.spam
      ? "spam"
      : code === SMTP_EXIT.auth
        ? "auth"
        : code === SMTP_EXIT.geo
          ? "geo"
          : "unknown";
  const geoHint =
    kind === "geo"
      ? [
          `- cause: ConoHa rejected GitHub Actions IP (US) — Incorrect country code`,
          `- fix: ConoHa メール設定で hello@ の「国外IP制限」を OFF → workflow 再実行`,
          `- alt: 日本IPのマシンから node buyout-ops/daily-send-one.mjs`,
        ]
      : [`- action: do NOT auto-failover further (${kind})`];
  appendEscalate(
    [
      `## ${jstDateString()} daily-send STOP — ${kind}`,
      `- company: ${company}`,
      `- smtp_exit: ${code}`,
      ...geoHint,
      `- quota: loadSendQuota remaining was ${loadSendQuota().remaining}`,
      "",
    ].join("\n")
  );
  console.error(`RESULT STOP — FAIL_KIND=${kind} (no further failover)`);
  process.exit(code || 1);
}

if (successes === 0 && attempts > 0 && !dryRun) {
  console.log(`RESULT no successful send after ${attempts} attempt(s)`);
  process.exit(1);
}

console.log(`RESULT complete successes=${successes} attempts=${attempts}`);
process.exit(0);
