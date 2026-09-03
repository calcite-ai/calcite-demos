#!/usr/bin/env node
/**
 * inside_sales_review_queue.csv の owner_ok=y + owner_campaign を
 * inside_sales_poc_leads.csv の status=approved に反映。
 *
 * Usage:
 *   node buyout-ops/import-inside-approvals.mjs --dry-run
 *   node buyout-ops/import-inside-approvals.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";
import { isPriorOutreachBlocked } from "./prior-outreach.mjs";
import { CAMPAIGNS } from "./campaign-score.mjs";
import { isAlreadyOutreached } from "./outreach-guard.mjs";
import { computeSendTier } from "./send-tier.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reviewPath = path.join(__dirname, "prospect_pipeline", "inside_sales_review_queue.csv");
const leadsPath = path.join(__dirname, "inside_sales_poc_leads.csv");
const dryRun = process.argv.includes("--dry-run");

const VALID_CAMPAIGNS = new Set(["hp_improve", "recruit", "ai_ops"]);

if (!fs.existsSync(reviewPath)) {
  console.error("FAIL missing inside_sales_review_queue.csv — run split-scan-tracks.mjs");
  process.exit(1);
}

if (!fs.existsSync(leadsPath)) {
  console.error("FAIL missing inside_sales_poc_leads.csv");
  process.exit(1);
}

const { rows: reviews } = parseCsv(fs.readFileSync(reviewPath, "utf8"));
const approved = reviews.filter((r) => /^y(es)?$/i.test(String(r.owner_ok || "").trim()));

if (!approved.length) {
  console.log("RESULT none — owner_ok=y の行がありません");
  process.exit(0);
}

const { headers, rows: leads } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
const today = new Date().toISOString().slice(0, 10);
let updated = 0;
let skipped = 0;

for (const r of approved) {
  const campaign = String(r.owner_campaign || r.recommended_campaign || "").trim();
  if (!VALID_CAMPAIGNS.has(campaign)) {
    console.log(`SKIP ${r.company}: owner_campaign 未設定 or 無効 (${campaign})`);
    skipped++;
    continue;
  }
  if (isPriorOutreachBlocked({ company: r.company, email: r.email })) {
    console.log(`SKIP blocklist: ${r.company}`);
    skipped++;
    continue;
  }

  const idx = leads.findIndex((l) => l.company === r.company && l.email === r.email);
  if (idx < 0) {
    console.log(`SKIP not in pool: ${r.company}`);
    skipped++;
    continue;
  }

  if (isAlreadyOutreached(leads[idx])) {
    console.log(
      `SKIP already outreached: ${r.company} status=${leads[idx].status || ""} sent_at=${leads[idx].sent_at || ""}`
    );
    skipped++;
    continue;
  }

  if (dryRun) {
    console.log(`DRY approve: ${r.company} → ${campaign} tier=${r.send_tier || "(auto)"} (${CAMPAIGNS[campaign]})`);
    updated++;
    continue;
  }

  leads[idx].owner_campaign = campaign;
  leads[idx].status = "approved";
  leads[idx].send_tier = String(r.send_tier || "").trim() || computeSendTier({ ...leads[idx], owner_campaign: campaign });
  const qseq = r.queue_seq ? `queue_seq=${r.queue_seq}` : "";
  leads[idx].notes = `${leads[idx].notes || ""} / owner承認 ${today} ${CAMPAIGNS[campaign]} ${qseq}`.trim();
  updated++;
  console.log(`OK ${r.company} → ${campaign} tier=${leads[idx].send_tier}`);
}

if (!dryRun && updated) {
  fs.writeFileSync(
    leadsPath,
    serializeCsv(headers.length ? headers : Object.keys(leads[0]), leads, {
      alwaysQuoteHeaders: ["site_url", "email", "campaign_evidence", "notes"],
    }) + "\n"
  );
}

console.log(`\nRESULT ${dryRun ? "dry-run " : ""}approved=${updated} skipped=${skipped}`);
