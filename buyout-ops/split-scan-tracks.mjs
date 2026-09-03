#!/usr/bin/env node
/**
 * scan_results + campaign_scores → buyout / inside リスト分割。
 *
 * Outputs:
 *   prospect_pipeline/inside_sales_review_queue.csv  — 人間レビュー（owner_campaign / owner_ok）
 *   inside_sales_poc_leads.csv                       — inside 候補プール
 *
 * Usage: node buyout-ops/split-scan-tracks.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";
import { assignTrack, normUrl } from "./campaign-score.mjs";
import {
  isAlreadyOutreached,
  preserveLeadStatus,
  TERMINAL_LEAD_STATUSES,
} from "./outreach-guard.mjs";
import { computeSendTier } from "./send-tier.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scanPath = path.join(__dirname, "prospect_pipeline", "scan_results.csv");
const scoresPath = path.join(__dirname, "prospect_pipeline", "campaign_scores.csv");
const reviewPath = path.join(__dirname, "prospect_pipeline", "inside_sales_review_queue.csv");
const leadsPath = path.join(__dirname, "inside_sales_poc_leads.csv");

const REVIEW_HEADERS = [
  "queue_seq",
  "company",
  "email",
  "url",
  "final_url",
  "prefecture",
  "scan_status",
  "track",
  "hp_score",
  "recruit_score",
  "ai_score",
  "recommended_campaign",
  "campaign_evidence",
  "owner_campaign",
  "send_tier",
  "owner_ok",
  "owner_notes",
];

const LEAD_HEADERS = [
  "company",
  "email",
  "site_url",
  "prefecture",
  "scan_status",
  "track",
  "hp_score",
  "recruit_score",
  "ai_score",
  "recommended_campaign",
  "campaign_evidence",
  "owner_campaign",
  "send_tier",
  "status",
  "notes",
  "sent_at",
];

function loadOwnerState() {
  const map = new Map();
  if (!fs.existsSync(reviewPath)) return map;
  for (const r of parseCsv(fs.readFileSync(reviewPath, "utf8")).rows) {
    map.set(normUrl(r.url), {
      owner_campaign: r.owner_campaign || "",
      owner_ok: r.owner_ok || "",
      owner_notes: r.owner_notes || "",
      send_tier: r.send_tier || "",
    });
  }
  return map;
}

function loadLeadState() {
  const map = new Map();
  if (!fs.existsSync(leadsPath)) return map;
  for (const r of parseCsv(fs.readFileSync(leadsPath, "utf8")).rows) {
    map.set(`${r.company}\t${r.email}`, r);
  }
  return map;
}

function main() {
  if (!fs.existsSync(scanPath)) {
    console.error("FAIL missing scan_results.csv");
    process.exit(1);
  }

  const { rows: scanRows } = parseCsv(fs.readFileSync(scanPath, "utf8"));
  const scoreByUrl = new Map();
  if (fs.existsSync(scoresPath)) {
    for (const r of parseCsv(fs.readFileSync(scoresPath, "utf8")).rows) {
      scoreByUrl.set(normUrl(r.url), r);
    }
  }

  const ownerState = loadOwnerState();
  const leadState = loadLeadState();
  const insidePool = [];
  const reviewRows = [];
  const seenLeadKeys = new Set();
  const stats = { buyout: 0, inside: 0, inside_skip: 0, skip: 0, terminal_preserved: 0 };

  for (const row of scanRows) {
    const k = normUrl(row.url);
    const score = scoreByUrl.get(k) || {};
    const track = score.track || assignTrack(row);

    if (track === "buyout") {
      stats.buyout++;
      continue;
    }
    if (track === "skip") {
      stats.skip++;
      continue;
    }

    stats.inside++;
    const rec = score.recommended_campaign || "skip";
    if (rec === "skip") stats.inside_skip++;

    const owner = ownerState.get(k) || { owner_campaign: "", owner_ok: "", owner_notes: "", send_tier: "" };
    const leadKey = `${row.company}\t${row.email}`;
    const existingLead = leadState.get(leadKey);
    seenLeadKeys.add(leadKey);

    const fallbackStatus = rec === "skip" ? "pool_skip" : "pool";
    const leadRow = {
      company: row.company,
      email: row.email,
      site_url: row.final_url || row.url,
      prefecture: row.prefecture || "",
      scan_status: row.status,
      track: "inside",
      hp_score: score.hp_score || "0",
      recruit_score: score.recruit_score || "0",
      ai_score: score.ai_score || "0",
      recommended_campaign: rec,
      campaign_evidence: score.campaign_evidence || "",
      owner_campaign: owner.owner_campaign || existingLead?.owner_campaign || "",
      send_tier: owner.send_tier || existingLead?.send_tier || "",
      // Never demote sent / opt_out / paused — pipeline refresh must not re-open them.
      status: preserveLeadStatus(existingLead, existingLead?.status || fallbackStatus),
      notes: existingLead?.notes || "",
      sent_at: existingLead?.sent_at || "",
    };
    if (isAlreadyOutreached(existingLead) && !TERMINAL_LEAD_STATUSES.has(leadRow.status)) {
      // notes/sent_at say already sent but status drifted — lock to sent
      leadRow.status = "sent";
    }
    leadRow.send_tier = leadRow.send_tier || computeSendTier(leadRow);
    insidePool.push(leadRow);

    if (rec !== "skip") {
      reviewRows.push({
        queue_seq: "",
        company: row.company,
        email: row.email,
        url: row.url,
        final_url: row.final_url || row.url,
        prefecture: row.prefecture || "",
        scan_status: row.status,
        track: "inside",
        hp_score: leadRow.hp_score,
        recruit_score: leadRow.recruit_score,
        ai_score: leadRow.ai_score,
        recommended_campaign: rec,
        campaign_evidence: leadRow.campaign_evidence,
        owner_campaign: owner.owner_campaign,
        send_tier: leadRow.send_tier,
        owner_ok: owner.owner_ok,
        owner_notes: owner.owner_notes,
      });
    }
  }

  // Keep terminal / already-sent leads that fell out of the current scan
  // (track change, email loss) so history and anti-resend evidence survive.
  for (const [leadKey, existing] of leadState) {
    if (seenLeadKeys.has(leadKey)) continue;
    if (!isAlreadyOutreached(existing) && !TERMINAL_LEAD_STATUSES.has(String(existing.status || "").trim())) {
      continue;
    }
    insidePool.push({
      company: existing.company || "",
      email: existing.email || "",
      site_url: existing.site_url || "",
      prefecture: existing.prefecture || "",
      scan_status: existing.scan_status || "",
      track: "inside",
      hp_score: existing.hp_score || "0",
      recruit_score: existing.recruit_score || "0",
      ai_score: existing.ai_score || "0",
      recommended_campaign: existing.recommended_campaign || "",
      campaign_evidence: existing.campaign_evidence || "",
      owner_campaign: existing.owner_campaign || "",
      send_tier: existing.send_tier || "",
      status: preserveLeadStatus(existing, existing.status || "sent"),
      notes: `${existing.notes || ""} / preserved_orphan_after_split`.trim(),
      sent_at: existing.sent_at || "",
    });
    stats.terminal_preserved++;
  }

  reviewRows.sort(
    (a, b) =>
      Number(b.hp_score) + Number(b.recruit_score) + Number(b.ai_score) -
      (Number(a.hp_score) + Number(a.recruit_score) + Number(a.ai_score))
  );
  reviewRows.forEach((r, i) => {
    r.queue_seq = String(i + 1);
  });

  fs.writeFileSync(
    reviewPath,
    serializeCsv(REVIEW_HEADERS, reviewRows, {
      alwaysQuoteHeaders: ["url", "final_url", "email", "campaign_evidence"],
    }) + "\n"
  );

  insidePool.sort((a, b) => a.company.localeCompare(b.company, "ja"));
  fs.writeFileSync(
    leadsPath,
    serializeCsv(LEAD_HEADERS, insidePool, {
      alwaysQuoteHeaders: ["site_url", "email", "campaign_evidence", "notes"],
    }) + "\n"
  );

  const byCampaign = {};
  for (const r of reviewRows) {
    byCampaign[r.recommended_campaign] = (byCampaign[r.recommended_campaign] || 0) + 1;
  }

  console.log("=== split-scan-tracks ===");
  console.log(`scan total: ${scanRows.length}`);
  console.log(`buyout track: ${stats.buyout}`);
  console.log(`inside track: ${stats.inside} (review queue: ${reviewRows.length}, pool_skip: ${stats.inside_skip})`);
  console.log(`skipped (no email etc): ${stats.skip}`);
  console.log(`terminal/orphan preserved: ${stats.terminal_preserved}`);
  console.log("review by campaign:", byCampaign);
  console.log(`review: ${reviewPath}`);
  console.log(`leads pool: ${leadsPath}`);
  console.log("\nNext: owner fills owner_campaign + owner_ok=y → import-inside-approvals.mjs");
}

main();
