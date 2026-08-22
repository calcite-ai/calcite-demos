#!/usr/bin/env node
/**
 * 9:00 JST refill orchestrator for Cursor Automation.
 *
 * Priority:
 * 1) sendable (queued+built with demos) exists → done
 * 2) owner-approved (status=approved) waiting for demo → agent builds 1 (exit 3)
 * 3) legacy: promote paused if no owner queue
 * 4) otherwise stop — wait for overnight scan + owner review (no random hunter)
 *
 * Usage: node buyout-ops/refill-queue-if-empty.mjs
 * Exit 0 = sendable exists. Exit 3 = build demo for next approved. Exit 2 = nothing to do.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, sortByApprovalSeq } from "./csv-util.mjs";
import { isPriorOutreachBlocked } from "./prior-outreach.mjs";
import { isActiveVertical } from "./vertical-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run(script, args = []) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script), ...args], {
    stdio: "inherit",
  });
  return r.status ?? 1;
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

const status = run("queue-status.mjs");
if (status === 0) {
  console.log("\nRESULT ok — send queue has targets (10:00 send)");
  process.exit(0);
}

const approvedCount = countApprovedWaiting();
if (approvedCount > 0) {
  console.log(`\nOwner queue: ${approvedCount} approved (demo未) → build next`);
  run("next-approved.mjs");
  console.log(
    "\nRESULT build — demo_buyout_owner_workflow.md §9:00: 先頭1社を G1→デモ→status=queued → push"
  );
  process.exit(3);
}

console.log("\nNo owner queue → try legacy promote paused…");
run("promote-paused.mjs", ["--apply"]);

const status2 = run("queue-status.mjs");
if (status2 === 0) {
  console.log("\nRESULT ok — promoted paused row to queued");
  process.exit(0);
}

console.log(
  "\nRESULT idle — sendable=0・承認キューなし。夜間スキャン→朝レビュー待ち（hunter-suggest しない）"
);
console.log("参照: demo_buyout_owner_workflow.md / demo_buyout_prospect_pipeline.md");
process.exit(2);
