#!/usr/bin/env node
/**
 * Daily inside-sales send (1社/日 quota).
 *
 * Usage: node buyout-ops/daily-send-inside-one.mjs [--dry-run]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";
import { loadSendQuota, jstDateString } from "./send-quota.mjs";
import { SMTP_EXIT } from "./smtp-error-kind.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const leadsPath = path.join(__dirname, "inside_sales_poc_leads.csv");
const dryRun = process.argv.includes("--dry-run");

function runCapture(args) {
  const r = spawnSync(process.execPath, args, { encoding: "utf8", cwd: root });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r;
}

function insideStatus() {
  const r = runCapture([path.join(__dirname, "inside-queue-status.mjs"), "--json"]);
  try {
    return JSON.parse(r.stdout || "{}");
  } catch {
    console.error("FAIL inside-queue-status JSON");
    process.exit(1);
  }
}

function markPaused(company, reason) {
  const { headers, rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
  const idx = rows.findIndex((r) => r.company === company);
  if (idx < 0) return;
  rows[idx].status = "paused";
  rows[idx].notes = `${rows[idx].notes || ""} / send_fail ${jstDateString()} ${reason}`.trim();
  fs.writeFileSync(
    leadsPath,
    serializeCsv(headers, rows, { alwaysQuoteHeaders: ["site_url", "email", "notes"] }) + "\n"
  );
  console.log(`RESULT inside paused: ${company} — ${reason}`);
}

let status = insideStatus();
if (status.inside_remaining <= 0) {
  console.log("RESULT skip inside — inside_remaining=0");
  process.exit(0);
}
if (!status.next?.company) {
  console.log("RESULT skip inside — no sendable approved");
  process.exit(0);
}

const need = status.inside_remaining;
const tried = new Set();
let successes = 0;
let attempts = 0;
const attemptCap = Math.min(5, need + 2);

console.log(`\n=== daily inside send remaining=${need} dryRun=${dryRun} ===`);

while (successes < need && attempts < attemptCap) {
  status = insideStatus();
  if (status.inside_remaining <= 0) break;
  const candidates = status.failover_candidates?.length
    ? status.failover_candidates
    : status.next_sends || [];
  const pick = candidates.find((c) => c.company && !tried.has(c.company));
  if (!pick?.company) break;
  tried.add(pick.company);
  attempts += 1;
  console.log(`\n=== inside attempt ${attempts}: ${pick.company} (${pick.campaign}, tier=${pick.send_tier || "?"}) ===`);

  const sendArgs = [
    path.join(__dirname, "send-inside-smtp.mjs"),
    "--company",
    pick.company,
  ];
  if (dryRun) sendArgs.push("--dry-run");
  const send = runCapture(sendArgs);
  const code = send.status ?? 1;

  if (dryRun && code === 0) {
    successes += 1;
    continue;
  }
  if (code === 0) {
    successes += 1;
    continue;
  }
  if (code === SMTP_EXIT.recipient) {
    markPaused(pick.company, "smtp_recipient");
    continue;
  }
  if (code === SMTP_EXIT.transient) {
    console.log("SKIP transient — try next");
    continue;
  }
  console.error(`RESULT STOP inside — exit=${code}`);
  process.exit(code || 1);
}

console.log(`RESULT inside complete successes=${successes} attempts=${attempts}`);
process.exit(successes > 0 || attempts === 0 ? 0 : 1);
