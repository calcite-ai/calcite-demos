#!/usr/bin/env node
/**
 * Inside sales send queue status（send_tier 優先: S → A → 月木のみ B）。
 *
 * Usage: node buyout-ops/inside-queue-status.mjs [--json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-util.mjs";
import { isPriorOutreachBlocked } from "./prior-outreach.mjs";
import { isValidPublicEmail } from "./campaign-score.mjs";
import { isAlreadyOutreached } from "./outreach-guard.mjs";
import { loadSendQuota, jstDateString } from "./send-quota.mjs";
import {
  computeSendTier,
  isInsideBsendDay,
  pickInsideSendCandidates,
  tierRank,
  weeklyBRemaining,
  WEEKLY_B_LIMIT,
} from "./send-tier.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const leadsPath = path.join(__dirname, "inside_sales_poc_leads.csv");
const today = jstDateString();

function queueSeq(row) {
  const m = String(row.notes || "").match(/queue_seq=(\d+)/);
  return m ? Number(m[1]) : 99999;
}

function isApprovedSendable(r) {
  return (
    r.status === "approved" &&
    !isAlreadyOutreached(r) &&
    isValidPublicEmail(r.email) &&
    !isPriorOutreachBlocked({ company: r.company, email: r.email }) &&
    ["recruit", "ai_ops", "hp_improve"].includes(String(r.owner_campaign || r.recommended_campaign || "").trim())
  );
}

function sortSendable(rows) {
  return [...rows].sort(
    (a, b) =>
      tierRank(a.send_tier) - tierRank(b.send_tier) ||
      queueSeq(a) - queueSeq(b) ||
      a.company.localeCompare(b.company, "ja")
  );
}

const { rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
const approvedRows = rows.filter(isApprovedSendable).map((r) => ({
  ...r,
  send_tier: String(r.send_tier || computeSendTier(r)).trim(),
  campaign: r.owner_campaign || r.recommended_campaign,
  queue_seq: queueSeq(r),
}));

const { pool, mode } = pickInsideSendCandidates(approvedRows, { today });
const sendableRows = sortSendable(pool);

const tierCounts = { S: 0, A: 0, B: 0, hold: 0 };
for (const r of approvedRows) {
  const t = r.send_tier || "hold";
  tierCounts[t] = (tierCounts[t] || 0) + 1;
}

const quota = loadSendQuota();
const need = quota.inside_remaining;
const nextSends = sendableRows.slice(0, need).map((r) => ({
  company: r.company,
  email: r.email,
  campaign: r.campaign,
  send_tier: r.send_tier,
  queue_seq: r.queue_seq,
}));

const result = {
  approved: rows.filter((r) => r.status === "approved").length,
  sendable: sendableRows.length,
  sendable_all_tiers: approvedRows.filter((r) => r.send_tier !== "hold").length,
  tier_counts: tierCounts,
  pick_mode: mode,
  b_send_day: isInsideBsendDay(today),
  weekly_b_limit: WEEKLY_B_LIMIT,
  weekly_b_sent: WEEKLY_B_LIMIT - weeklyBRemaining(today),
  weekly_b_remaining: weeklyBRemaining(today),
  inside_remaining: quota.inside_remaining,
  inside_sent_today: quota.inside_sent_today,
  next: nextSends[0] || null,
  next_sends: nextSends,
  failover_candidates: sendableRows.slice(0, Math.min(8, need + 3)).map((r) => ({
    company: r.company,
    email: r.email,
    campaign: r.campaign,
    send_tier: r.send_tier,
  })),
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(
    `inside approved=${result.approved} sendable_today=${result.sendable} (all_tiers=${result.sendable_all_tiers}) mode=${result.pick_mode} sent_today=${result.inside_sent_today} remaining=${result.inside_remaining}`
  );
  console.log(
    `tiers(approved): S=${tierCounts.S} A=${tierCounts.A} B=${tierCounts.B} | B枠: 週残${result.weekly_b_remaining}/${WEEKLY_B_LIMIT} 今日B日=${result.b_send_day}`
  );
  if (result.next) {
    console.log(
      `next_inside: [${result.next.queue_seq}] ${result.next.company} (${result.next.campaign}, tier=${result.next.send_tier})`
    );
  } else if (result.inside_remaining === 0) {
    console.log("next_inside: (quota full)");
  } else if (mode === "none" && tierCounts.B > 0) {
    console.log("next_inside: (Bのみ待ち — 月・木に週枠で送信)");
  } else {
    console.log("next_inside: (none sendable)");
  }
}

process.exit(result.inside_remaining > 0 && result.sendable > 0 ? 0 : 2);
