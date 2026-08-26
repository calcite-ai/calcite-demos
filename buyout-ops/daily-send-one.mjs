#!/usr/bin/env node
/**
 * One daily buyout send (GitHub Actions 10:00 JST).
 *
 * 1) queue-status — exit early if no remaining / no sendable
 * 2) verify gates
 * 3) SMTP text/plain send
 * 4) mark CSV status=sent
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
import { jstDateString } from "./send-quota.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const leadsPath = path.join(__dirname, "demo_buyout_leads.csv");
const dryRun = process.argv.includes("--dry-run");

function run(args) {
  const r = spawnSync(process.execPath, args, {
    encoding: "utf8",
    cwd: root,
    env: process.env,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status ?? 1;
}

const statusProc = spawnSync(
  process.execPath,
  [path.join(__dirname, "queue-status.mjs"), "--json"],
  { encoding: "utf8", cwd: root }
);
if (statusProc.stderr) process.stderr.write(statusProc.stderr);
let status;
try {
  status = JSON.parse(statusProc.stdout || "");
} catch {
  console.error("FAIL queue-status JSON parse");
  process.exit(1);
}

if (status.remaining_today <= 0) {
  console.log("RESULT skip — remaining_today=0");
  process.exit(0);
}
if (!status.next?.company) {
  console.log("RESULT skip — no sendable (9:00 refill may have failed)");
  process.exit(0);
}

const company = status.next.company;
console.log(`\n=== daily send: ${company} ===`);

if (run([path.join(__dirname, "verify-ops-pack.mjs")]) !== 0) process.exit(1);
if (
  run([path.join(__dirname, "verify-hunter-g1.mjs"), "--from-csv", "--company", company]) !== 0
) {
  process.exit(1);
}
if (
  run([path.join(__dirname, "verify-before-send.mjs"), "--from-csv", "--company", company]) !== 0
) {
  process.exit(1);
}

const sendArgs = [path.join(__dirname, "send-outreach-smtp.mjs"), "--company", company];
if (dryRun) sendArgs.push("--dry-run");
const send = spawnSync(process.execPath, sendArgs, {
  encoding: "utf8",
  cwd: root,
  env: process.env,
});
if (send.stdout) process.stdout.write(send.stdout);
if (send.stderr) process.stderr.write(send.stderr);
if (send.status !== 0) process.exit(send.status || 1);

if (dryRun) {
  console.log("RESULT dry-run complete — CSV unchanged");
  process.exit(0);
}

const idMatch = (send.stdout || "").match(/SMTP_MESSAGE_ID=(.+)/);
const messageId = (idMatch?.[1] || "").trim() || "unknown";
const today = jstDateString();

const { headers, rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
const idx = rows.findIndex((r) => r.company === company);
if (idx < 0) {
  console.error("FAIL company missing after send");
  process.exit(1);
}
rows[idx].status = "sent";
rows[idx].notes = `初回送信済 ${today} / SMTP ${messageId} / GitHub Actions daily-send`;
fs.writeFileSync(leadsPath, serializeCsv(headers, rows) + "\n");
console.log(`RESULT marked sent: ${company}`);
process.exit(0);
