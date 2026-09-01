#!/usr/bin/env node
/**
 * 9:00 JST refill orchestrator for Cursor Automation.
 *
 * Priority:
 * 1) today's send quota already filled → done
 * 2) sendable >= remaining_today → done (10:00 send)
 * 3) owner-approved waiting for demo → agent builds 1 (exit 3); Automation loops until 2)
 * 4) legacy: promote paused if no owner queue
 * 5) otherwise stop — wait for overnight scan + owner review
 *
 * Usage: node buyout-ops/refill-queue-if-empty.mjs
 * Exit 0 = enough sendable for today (or quota full). Exit 3 = build demo. Exit 2 = nothing to do.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, sortByApprovalSeq } from "./csv-util.mjs";
import { isPriorOutreachBlocked } from "./prior-outreach.mjs";
import { isActiveVertical } from "./vertical-config.mjs";
import { loadSendQuota } from "./send-quota.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run(script, args = [], inherit = true) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script), ...args], {
    encoding: "utf8",
    stdio: inherit ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
  });
  if (inherit) {
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
  }
  return r;
}

function countApprovedWaiting() {
  const leadsPath = path.join(__dirname, "demo_buyout_leads.csv");
  const { rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
  return sortByApprovalSeq(
    rows.filter(
      (r) =>
        r.status === "approved" &&
        String(r.do_not_contact).toLowerCase() !== "true" &&
        !isPriorOutreachBlocked({ company: r.company, email: r.email }) &&
        isActiveVertical(r)
    )
  ).length;
}

console.log("=== refill-queue-if-empty ===\n");

const quota = loadSendQuota();
run("queue-status.mjs");
const statusJsonEarly = run("queue-status.mjs", ["--json"], false);
let qEarly;
try {
  qEarly = JSON.parse(statusJsonEarly.stdout || "{}");
} catch {
  qEarly = { buyout_remaining: quota.buyout_remaining };
}
const need = Math.max(0, qEarly.buyout_remaining ?? quota.buyout_remaining);
console.log(
  `\nquota: daily_buyout=${quota.daily_buyout} buyout_sent_today=${quota.buyout_sent_today} buyout_remaining=${need} inside_remaining=${quota.inside_remaining} from=${quota.effective_from}`
);

if (need === 0 && quota.buyout_remaining === 0) {
  console.log("\nRESULT ok — 今日の buyout 送信枠は満了（send-quota.csv）");
  process.exit(0);
}

const statusJson = run("queue-status.mjs", ["--json"], false);
let q;
try {
  q = JSON.parse(statusJson.stdout || "{}");
} catch {
  q = { sendable: 0 };
}

if ((q.sendable || 0) >= need) {
  console.log(`\nRESULT ok — sendable=${q.sendable} >= remaining=${need}（10:00 send）`);
  process.exit(0);
}

const approvedCount = countApprovedWaiting();
if (approvedCount > 0) {
  const stillNeed = need - (q.sendable || 0);
  console.log(
    `\nOwner queue: ${approvedCount} approved (demo未) → build next (${stillNeed} more for today's quota)`
  );
  run("next-approved.mjs");
  console.log(
    "\nRESULT build — demo_buyout_owner_workflow.md §9:00: 先頭1社を G1→デモ→status=queued → push。その後このスクリプトを再実行（残枠が埋まるまで）"
  );
  process.exit(3);
}

console.log("\nNo owner queue → try legacy promote paused…");
run("promote-paused.mjs", ["--apply"]);

run("queue-status.mjs");
const statusJson2 = run("queue-status.mjs", ["--json"], false);
let q2;
try {
  q2 = JSON.parse(statusJson2.stdout || "{}");
} catch {
  q2 = { sendable: 0 };
}
if ((q2.sendable || 0) >= 1) {
  console.log("\nRESULT ok — promoted paused row to queued");
  process.exit(0);
}

console.log(
  "\nRESULT idle — sendable不足・承認キューなし。夜間スキャン→朝レビュー待ち（hunter-suggest しない）"
);
console.log("参照: demo_buyout_owner_workflow.md / demo_buyout_prospect_pipeline.md / send-quota.csv");
process.exit(2);
