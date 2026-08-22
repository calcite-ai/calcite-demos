#!/usr/bin/env node
/**
 * 承認キュー（status=approved）の先頭1社 — 9:00 Hunter 用。
 * Usage: node buyout-ops/next-approved.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, sortByApprovalSeq } from "./csv-util.mjs";
import { isPriorOutreachBlocked } from "./prior-outreach.mjs";
import { isActiveVertical } from "./vertical-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const leadsPath = path.join(__dirname, "demo_buyout_leads.csv");

const { rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
const pending = sortByApprovalSeq(
  rows.filter(
    (r) =>
      r.status === "approved" &&
      String(r.do_not_contact).toLowerCase() !== "true" &&
      !isPriorOutreachBlocked({ company: r.company, email: r.email }) &&
      isActiveVertical(r)
  )
);

if (!pending.length) {
  console.log("RESULT none — no status=approved in owner queue");
  process.exit(2);
}

const n = pending[0];
console.log("NEXT_APPROVED:");
console.log(`  seq: ${n.approval_seq}`);
console.log(`  company: ${n.company}`);
console.log(`  email: ${n.email}`);
console.log(`  site: ${n.site_url}`);
console.log(`  audit: ${(n.audit_notes || "").slice(0, 120)}…`);
process.exit(0);
