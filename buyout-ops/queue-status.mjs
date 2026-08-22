#!/usr/bin/env node
/**
 * Report send-queue depth for daily automation.
 * Exit 0 = has sendable targets. Exit 2 = empty.
 *
 * Send order: lowest approval_seq first (owner OK list), then legacy rows without seq.
 *
 * Usage:
 *   node buyout-ops/queue-status.mjs
 *   node buyout-ops/queue-status.mjs --json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, sortByApprovalSeq } from "./csv-util.mjs";
import { ACTIVE_VERTICAL, isActiveVertical, verticalLabel } from "./vertical-config.mjs";
import { isPriorOutreachBlocked } from "./prior-outreach.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(__dirname, "demo_buyout_leads.csv");
const rows = parseCsv(fs.readFileSync(csvPath, "utf8")).rows;

function isG1Excluded(r) {
  return /G1不合格|G1見送り|サイト新し/.test(`${r.audit_notes || ""} ${r.notes || ""}`);
}

function isSendableRow(r) {
  return (
    (r.status === "queued" || r.status === "built") &&
    String(r.do_not_contact).toLowerCase() !== "true" &&
    !isPriorOutreachBlocked({ company: r.company, email: r.email }) &&
    r.demo_url_a &&
    r.demo_url_b &&
    isActiveVertical(r) &&
    !isG1Excluded(r)
  );
}

const sendableRows = sortByApprovalSeq(rows.filter(isSendableRow));
const approvedWaiting = sortByApprovalSeq(
  rows.filter(
    (r) =>
      r.status === "approved" &&
      String(r.do_not_contact).toLowerCase() !== "true" &&
      !isPriorOutreachBlocked({ company: r.company, email: r.email }) &&
      isActiveVertical(r) &&
      !isG1Excluded(r)
  )
);

const result = {
  queued: rows.filter((r) => r.status === "queued").length,
  built: rows.filter((r) => r.status === "built").length,
  approved_waiting: approvedWaiting.length,
  sendable: sendableRows.length,
  next: sendableRows[0]
    ? {
        company: sendableRows[0].company,
        email: sendableRows[0].email,
        status: sendableRows[0].status,
        approval_seq: sendableRows[0].approval_seq || "",
      }
    : null,
  next_approved_build: approvedWaiting[0]
    ? {
        company: approvedWaiting[0].company,
        email: approvedWaiting[0].email,
        approval_seq: approvedWaiting[0].approval_seq || "",
      }
    : null,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(
    `queued=${result.queued} built=${result.built} approved_waiting=${result.approved_waiting} sendable=${result.sendable} vertical=${ACTIVE_VERTICAL}(${verticalLabel(ACTIVE_VERTICAL)})`
  );
  if (result.next) {
    console.log(
      `next_send: [${result.next.approval_seq || "-"}] ${result.next.company} (${result.next.status})`
    );
  }
  if (result.next_approved_build) {
    console.log(
      `next_build: [${result.next_approved_build.approval_seq}] ${result.next_approved_build.company} (approved→デモ未)`
    );
  }
}

process.exit(result.sendable > 0 ? 0 : 2);
