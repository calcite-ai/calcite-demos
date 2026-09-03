#!/usr/bin/env node
/**
 * review_queue.csv の owner_ok=y を demo_buyout_leads に status=approved で投入。
 * approval_seq 順に、翌日以降 9:00/10:00 が上から1社/日処理する。
 *
 * Usage: node buyout-ops/import-review-approvals.mjs
 *        node buyout-ops/import-review-approvals.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv, sortByApprovalSeq } from "./csv-util.mjs";
import { isPriorOutreachBlocked } from "./prior-outreach.mjs";
import { isValidPublicEmail } from "./campaign-score.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reviewPath = path.join(__dirname, "prospect_pipeline", "review_queue.csv");
const leadsPath = path.join(__dirname, "demo_buyout_leads.csv");
const dryRun = process.argv.includes("--dry-run");

const LEAD_HEADERS = [
  "company",
  "email",
  "site_url",
  "audit_notes",
  "pay_signals",
  "skin_pair",
  "demo_url_a",
  "demo_url_b",
  "status",
  "reply_class",
  "checkout_status",
  "intake_status",
  "delivered_url",
  "source",
  "do_not_contact",
  "quoted_price",
  "vertical",
  "notes",
  "approval_seq",
  "owner_approved_at",
];

if (!fs.existsSync(reviewPath)) {
  console.error("FAIL missing review_queue.csv — run prepare-review-sheet.mjs");
  process.exit(1);
}

const { rows: reviews } = parseCsv(fs.readFileSync(reviewPath, "utf8"));
const approved = sortByApprovalSeq(
  reviews.filter((r) => /^y(es)?$/i.test(String(r.owner_ok || "").trim()))
);

if (!approved.length) {
  console.log("RESULT none — owner_ok=y の行がありません");
  process.exit(0);
}

const { headers: existingHeaders, rows: existing } = parseCsv(
  fs.readFileSync(leadsPath, "utf8")
);
const known = new Set(existing.map((r) => `${r.company}\t${r.email}`));

const today = new Date().toISOString().slice(0, 10);
const toAdd = [];
let seq = 1;

for (const r of approved) {
  const company = r.company;
  const email = r.email;
  const site = r.final_url || r.url;
  if (!isValidPublicEmail(email)) {
    console.log(`SKIP invalid email: ${company} <${email || "(empty)"}>`);
    continue;
  }
  if (isPriorOutreachBlocked({ company, email })) {
    console.log(`SKIP blocklist: ${company}`);
    continue;
  }
  if (known.has(`${company}\t${email}`)) {
    console.log(`SKIP already in leads: ${company}`);
    continue;
  }
  const audit = `2026-08-23 owner承認。scan:${r.audit_draft || r.defects}. C0/C3は送信前再確認`;
  toAdd.push({
    company,
    email,
    site_url: site,
    audit_notes: audit,
    pay_signals: "法人・中小",
    skin_pair: "",
    demo_url_a: "",
    demo_url_b: "",
    status: "approved",
    reply_class: "",
    checkout_status: "",
    intake_status: "unpaid",
    delivered_url: "not_sent",
    source: "owner_review",
    do_not_contact: "",
    quoted_price: "66000",
    vertical: "koumuten",
    notes: r.owner_notes || "オーナー承認キュー",
    approval_seq: String(r.approval_seq || seq),
    owner_approved_at: today,
  });
  seq++;
}

if (!toAdd.length) {
  console.log("RESULT none — 追加行なし（すべてスキップ）");
  process.exit(0);
}

console.log(`IMPORT ${toAdd.length} approved rows${dryRun ? " (dry-run)" : ""}:`);
for (const r of toAdd) {
  console.log(`  [${r.approval_seq}] ${r.company} <${r.email}>`);
}

if (dryRun) process.exit(0);

const headers = LEAD_HEADERS.every((h) => existingHeaders.includes(h))
  ? existingHeaders
  : LEAD_HEADERS;
for (const row of existing) {
  if (!row.approval_seq) row.approval_seq = "";
  if (!row.owner_approved_at) row.owner_approved_at = "";
}
const merged = [...existing, ...toAdd];
fs.writeFileSync(leadsPath, serializeCsv(headers, merged) + "\n");
console.log(`RESULT wrote ${leadsPath}`);
