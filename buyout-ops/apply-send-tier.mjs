#!/usr/bin/env node
/**
 * inside リストに send_tier（S/A/B/hold）を付与・更新。
 *
 * Usage:
 *   node buyout-ops/apply-send-tier.mjs
 *   node buyout-ops/apply-send-tier.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";
import { computeSendTier } from "./send-tier.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reviewPath = path.join(__dirname, "prospect_pipeline", "inside_sales_review_queue.csv");
const leadsPath = path.join(__dirname, "inside_sales_poc_leads.csv");
const dryRun = process.argv.includes("--dry-run");

function applyFile(filePath, label) {
  const { headers, rows } = parseCsv(fs.readFileSync(filePath, "utf8"));
  let hdrs = headers.includes("send_tier") ? headers : [...headers, "send_tier"];
  const counts = { S: 0, A: 0, B: 0, hold: 0 };

  for (const r of rows) {
    const tier = computeSendTier(r);
    r.send_tier = tier;
    counts[tier] = (counts[tier] || 0) + 1;
  }

  if (!dryRun) {
    fs.writeFileSync(
      filePath,
      serializeCsv(hdrs, rows, {
        alwaysQuoteHeaders: ["url", "final_url", "email", "site_url", "campaign_evidence", "notes"],
      }) + "\n"
    );
  }

  console.log(`${label}: ${rows.length} rows — S=${counts.S} A=${counts.A} B=${counts.B} hold=${counts.hold}`);
  return counts;
}

console.log(`=== apply-send-tier ${dryRun ? "(dry-run)" : ""} ===\n`);
applyFile(reviewPath, "review_queue");
applyFile(leadsPath, "poc_leads");
console.log("\nRESULT ok — owner は send_tier 列でソートして承認。手動上書き可（S/A/B/hold）");
