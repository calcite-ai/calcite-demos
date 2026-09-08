#!/usr/bin/env node
/**
 * Daily buyout follow-up send (2nd touch, unreplied).
 *
 * ルール（2026-09-08 オーナー決定）:
 *   - 初回送信から5日後・未返信のみ。1リード1回だけ（followup_sent_at で管理）
 *   - quoted_price=55000（旧価格コホート）は対象外
 *   - デモ本文ゲート（verify-demo-content.mjs）に通らないリードは対象外
 *   - 新規送信枠（daily_buyout）とは別枠でカウント（send-quota.csv の daily_followup）
 *   - 相手には「直した」とは言わない（本文はテンプレのまま・修正の事実は書かない）
 *
 * Usage:
 *   node buyout-ops/daily-send-followup.mjs
 *   node buyout-ops/daily-send-followup.mjs --dry-run
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";
import { jstDateString, loadSendQuota } from "./send-quota.mjs";
import { SMTP_EXIT } from "./smtp-error-kind.mjs";
import { outsideSendWindow, sendWindowSkipLine } from "./send-window.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const leadsPath = path.join(__dirname, "demo_buyout_leads.csv");
const dryRun = process.argv.includes("--dry-run");

const FOLLOWUP_WAIT_DAYS = 5;

function runCapture(args) {
  const r = spawnSync(process.execPath, args, { encoding: "utf8", cwd: root, env: process.env });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r;
}

function daysAgoJst(days) {
  const now = new Date();
  const jstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  jstNow.setDate(jstNow.getDate() - days);
  return jstDateString(jstNow);
}

function eligibleCandidates(today) {
  const { rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
  const cutoff = daysAgoJst(FOLLOWUP_WAIT_DAYS);
  return rows.filter((r) => {
    if (r.status !== "sent") return false;
    if (r.reply_at) return false;
    if (r.followup_sent_at) return false;
    if (String(r.quoted_price).trim() === "55000") return false;
    if (r.do_not_contact === "true") return false;
    const sentAt = String(r.sent_at || "").slice(0, 10);
    if (!sentAt) return false;
    if (sentAt > cutoff) return false; // まだ5日経っていない
    if (!r.demo_url_a) return false;
    return true;
  });
}

function markFollowupSent(company, messageId) {
  const { headers, rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
  const idx = rows.findIndex((r) => r.company === company);
  if (idx < 0) return;
  const today = jstDateString();
  let hdrs = headers.includes("followup_sent_at") ? headers : [...headers, "followup_sent_at"];
  rows[idx].followup_sent_at = today;
  rows[idx].notes = `${rows[idx].notes || ""} / フォロー送信済 ${today} / SMTP ${messageId}`.trim();
  fs.writeFileSync(leadsPath, serializeCsv(hdrs, rows) + "\n");
  console.log(`RESULT marked followup sent: ${company}`);
}

function markFollowupSkip(company, reason) {
  const { headers, rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
  const idx = rows.findIndex((r) => r.company === company);
  if (idx < 0) return;
  const today = jstDateString();
  let hdrs = headers.includes("followup_sent_at") ? headers : [...headers, "followup_sent_at"];
  // ゲートFAIL等で送れない場合、"skip:YYYY-MM-DD" を残して毎日再チェックしない（再挑戦は人が直してから notes を消す）
  rows[idx].followup_sent_at = `skip:${today}`;
  rows[idx].notes = `${rows[idx].notes || ""} / フォロー見送り ${today} (${reason})`.trim();
  fs.writeFileSync(leadsPath, serializeCsv(hdrs, rows) + "\n");
  console.log(`RESULT followup skipped (marked, no retry until notes cleared): ${company} — ${reason}`);
}

const off = outsideSendWindow();
if (off && !dryRun) {
  console.log(sendWindowSkipLine(off));
  process.exit(0);
}

const quota = loadSendQuota();
if (quota.followup_remaining <= 0) {
  console.log(`RESULT skip — followup_remaining=0 (daily_followup=${quota.daily_followup})`);
  process.exit(0);
}

const today = jstDateString();
const candidates = eligibleCandidates(today);
if (!candidates.length) {
  console.log(`RESULT skip — no follow-up candidates (5日経過・未返信・本文ゲートPASS待ち)`);
  process.exit(0);
}

console.log(
  `\n=== daily follow-up start remaining=${quota.followup_remaining} candidates=${candidates.length} dryRun=${dryRun} ===`
);

let successes = 0;
for (const c of candidates) {
  if (successes >= quota.followup_remaining) break;
  const company = c.company;
  console.log(`\n=== follow-up candidate: ${company} (sent_at=${c.sent_at}) ===`);

  const gate = runCapture([
    path.join(__dirname, "verify-demo-content.mjs"),
    "--from-csv",
    "--company",
    company,
    "--skip-site",
    "--skip-email",
  ]);
  if (gate.status !== 0) {
    if (dryRun) {
      console.log(`RESULT dry-run would skip (gate FAIL, not marked): ${company}`);
    } else {
      markFollowupSkip(company, "verify-demo-content FAIL — デモの修正が先");
    }
    continue;
  }

  const sendArgs = [path.join(__dirname, "send-followup-smtp.mjs"), "--company", company];
  if (dryRun) sendArgs.push("--dry-run");
  const send = runCapture(sendArgs);
  const code = send.status ?? 1;

  if (dryRun) {
    if (code === 0) {
      successes += 1;
      console.log(`RESULT dry-run would send follow-up: ${company}`);
    }
    continue;
  }

  if (code === 0) {
    const idMatch = (send.stdout || "").match(/SMTP_MESSAGE_ID=(.+)/);
    const messageId = (idMatch?.[1] || "").trim() || "unknown";
    markFollowupSent(company, messageId);
    successes += 1;
    continue;
  }

  if (code === SMTP_EXIT.recipient) {
    console.log(`SKIP recipient reject — leave as-is for manual review: ${company}`);
    continue;
  }

  console.log(`SKIP send-followup-smtp exit=${code} — try next: ${company}`);
}

console.log(`RESULT complete followups=${successes}`);
process.exit(0);
