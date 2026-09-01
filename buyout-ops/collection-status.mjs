#!/usr/bin/env node
/**
 * 送信枠から逆算したリスト収集の在庫・目標。
 *
 * Usage: node buyout-ops/collection-status.mjs [--json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-util.mjs";
import { loadSendQuota, jstDateString } from "./send-quota.mjs";
import { isPriorOutreachBlocked } from "./prior-outreach.mjs";
import { isValidPublicEmail } from "./campaign-score.mjs";
import { pickInsideSendCandidates, weeklyBRemaining, WEEKLY_B_LIMIT } from "./send-tier.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readCsv(rel) {
  const p = path.join(__dirname, rel);
  if (!fs.existsSync(p)) return { rows: [] };
  return parseCsv(fs.readFileSync(p, "utf8"));
}

function queueSeq(row) {
  const m = String(row.notes || "").match(/queue_seq=(\d+)/);
  return m ? Number(m[1]) : 99999;
}

const quota = loadSendQuota();
const buyoutRows = readCsv("demo_buyout_leads.csv").rows;
const insideRows = readCsv("inside_sales_poc_leads.csv").rows;
const scanRows = readCsv("prospect_pipeline/scan_results.csv").rows;
const seedRows = readCsv("seeds/koumuten_urls.csv").rows;
const reviewRows = readCsv("prospect_pipeline/review_queue.csv").rows;

const buyout = {
  sent: buyoutRows.filter((r) => r.status === "sent").length,
  queued: buyoutRows.filter((r) => r.status === "queued").length,
  approved: buyoutRows.filter((r) => r.status === "approved").length,
  approved_with_demo: buyoutRows.filter(
    (r) => r.status === "approved" && r.demo_url_a && r.demo_url_b
  ).length,
  approved_no_demo: buyoutRows.filter(
    (r) => r.status === "approved" && (!r.demo_url_a || !r.demo_url_b)
  ).length,
  paused: buyoutRows.filter((r) => r.status === "paused").length,
};

const insideApproved = insideRows.filter((r) => r.status === "approved");
const insideSendable = insideApproved.filter(
  (r) =>
    isValidPublicEmail(r.email) &&
    !isPriorOutreachBlocked({ company: r.company, email: r.email }) &&
    ["recruit", "ai_ops", "hp_improve"].includes(
      String(r.owner_campaign || r.recommended_campaign || "").trim()
    )
);
const insideWithTier = insideSendable.map((r) => ({
  ...r,
  send_tier: String(r.send_tier || "A").trim(),
  queue_seq: queueSeq(r),
}));
const { pool: insidePoolToday } = pickInsideSendCandidates(insideWithTier, {
  today: jstDateString(),
});
const tierCounts = { S: 0, A: 0, B: 0 };
for (const r of insideWithTier) {
  if (tierCounts[r.send_tier] != null) tierCounts[r.send_tier]++;
}

const scan = {
  total: scanRows.length,
  CANDIDATE: scanRows.filter((r) => r.status === "CANDIDATE").length,
  G1_MODERN: scanRows.filter((r) => r.status === "G1_MODERN").length,
  G1_WEAK: scanRows.filter((r) => r.status === "G1_WEAK").length,
  NO_EMAIL: scanRows.filter((r) => r.status === "NO_EMAIL").length,
  FETCH_FAIL: scanRows.filter((r) => r.status === "FETCH_FAIL").length,
};

const scannedUrls = new Set(scanRows.map((r) => r.url));
const unscannedSeeds = seedRows.filter((r) => !scannedUrls.has(r.url));

const dailyBuyout = quota.daily_buyout ?? quota.daily_sends ?? 1;
const dailyInside = quota.daily_inside ?? 0;
const monthlyBuyout = dailyBuyout * 30;
const monthlyInside = dailyInside * 30;

/** 在庫バッファ（日） */
const BUFFER_DAYS = 90;

const buyoutSendRunway = buyout.queued + buyout.approved_with_demo;
const insideRunway = insideSendable.length;

/** スキャン実績から buyout CANDIDATE 率 */
const candidateRate = scan.total ? scan.CANDIDATE / scan.total : 0.06;
const seedsPerCandidate = candidateRate > 0 ? Math.ceil(1 / candidateRate) : 17;

/** 週次目標（逆算 — buyout 1/日・inside 収集 pause 前提） */
const candidateTargetPerMonth = Math.max(8, dailyBuyout * 8);
const buyout_new_seeds_per_week =
  unscannedSeeds.length >= 50
    ? 0
    : unscannedSeeds.length < 20
      ? Math.min(40, Math.ceil((candidateTargetPerMonth * seedsPerCandidate) / 4))
      : 10;

const targets = {
  buyout_new_seeds_per_week,
  buyout_demo_build_per_week: Math.max(dailyBuyout * 5, buyout.approved_no_demo > 0 ? dailyBuyout * 5 : 0),
  inside_new_seeds_per_week:
    insideRunway < BUFFER_DAYS ? Math.ceil(((BUFFER_DAYS - insideRunway) / 30) * 15) : 0,
  no_email_rescan_batch_per_week: scan.NO_EMAIL > 50 ? 40 : 0,
  fetch_fail_rescan_per_week: scan.FETCH_FAIL > 30 ? 30 : 0,
};

const mode = {
  inside_collection: insideRunway >= BUFFER_DAYS ? "pause" : "active",
  buyout_collection: unscannedSeeds.length < 20 ? "new_seeds" : "scan_backlog",
  buyout_bottleneck:
    buyout.approved_no_demo > buyout.queued ? "nine_am_automation" : "review_or_seeds",
};

const actions = [];
if (mode.buyout_bottleneck === "nine_am_automation") {
  actions.push(
    `buyout: **9:00 Cursor Automation** がデモ制作 — approved デモ未 ${buyout.approved_no_demo} / 次 ${buyout.approved_no_demo > 0 ? "next-approved.mjs 参照" : "—"}（手動週次制作ではない）`
  );
  if (buyout.approved_no_demo > 30) {
    actions.push(
      `承認一括取込 ${buyout.approved_no_demo}社 — 9:00 は当日残枠ぶんのみ（約 ${dailyBuyout}/日）。消化に ${Math.ceil(buyout.approved_no_demo / dailyBuyout)} 日`
    );
  }
}
if (mode.inside_collection === "pause") {
  actions.push(
    `inside: 収集・承認停止 — approved ${insideRunway}社 ≒ ${insideRunway}日分（目標バッファ ${BUFFER_DAYS}日）`
  );
} else {
  actions.push(`inside: 週 ${targets.inside_new_seeds_per_week} 種URL 追加`);
}
if (unscannedSeeds.length === 0 && scan.total > 0) {
  actions.push(
    `種URL: マスタ ${seedRows.length} / スキャン済 ${scan.total} — 新規種の追加が必要（週 ${targets.buyout_new_seeds_per_week} 件目安・CANDIDATE率 ${(candidateRate * 100).toFixed(1)}%）`
  );
}
if (scan.NO_EMAIL >= 50) {
  actions.push(`再スキャン: NO_EMAIL ${scan.NO_EMAIL} → 週 ${targets.no_email_rescan_batch_per_week} 件を prospect-rescan-no-email.mjs`);
}
if (reviewRows.length > 0 && buyout.approved_no_demo > 10) {
  actions.push(`buyout review: ${reviewRows.length} 社レビュー済 — 新 CANDIDATE より先にデモ＋queued 化`);
}

const bestSources = [
  "手動 Maps / http_research（CANDIDATE率高）",
  "住活協 builderlist（jyukatsukyo_* cache）",
  "商工会・自治体PDF（メール欄あり公式リスト）",
  "低優先: sahn / 大規模会員一覧のみ（NO_EMAIL多）",
];

const result = {
  date: jstDateString(),
  send_quota: {
    daily_buyout: dailyBuyout,
    daily_inside: dailyInside,
    monthly_total: (dailyBuyout + dailyInside) * 30,
  },
  runway_days: {
    buyout_send_ready: buyoutSendRunway,
    buyout_approved_no_demo: buyout.approved_no_demo,
    inside_approved_sendable: insideRunway,
    bottleneck: Math.min(buyoutSendRunway || 0, insideRunway || 9999),
  },
  inside_tiers: tierCounts,
  inside_pool_today: insidePoolToday.length,
  scan,
  seeds: { total: seedRows.length, unscanned: unscannedSeeds.length },
  review_queue: reviewRows.length,
  mode,
  targets,
  recommended_sources: bestSources,
  actions,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`=== collection-status ${result.date} ===\n`);
  console.log(
    `送信: buyout ${dailyBuyout}/日 + inside ${dailyInside}/日 → 月 ${result.send_quota.monthly_total} 通`
  );
  console.log(
    `在庫(日): buyout 送信可能 ${buyoutSendRunway}（デモ済）/ approvedデモ未 ${buyout.approved_no_demo} | inside ${insideRunway}（S${tierCounts.S} A${tierCounts.A} B${tierCounts.B}）`
  );
  console.log(
    `スキャン: ${scan.total} 件 CANDIDATE=${scan.CANDIDATE} NO_EMAIL=${scan.NO_EMAIL} FETCH_FAIL=${scan.FETCH_FAIL} | 未スキャン種 ${unscannedSeeds.length}`
  );
  console.log(`\nモード: inside=${mode.inside_collection} buyout=${mode.buyout_collection} ボトルネック=${mode.buyout_bottleneck}`);
  console.log("\n今やること:");
  for (const a of actions) console.log(`  • ${a}`);
  console.log("\n収集ソース優先:");
  for (const s of bestSources) console.log(`  • ${s}`);
  console.log(
    `\n週次目標（逆算）: 新種URL ${targets.buyout_new_seeds_per_week} / inside追加 ${targets.inside_new_seeds_per_week} / NO_EMAIL再スキャン ${targets.no_email_rescan_batch_per_week}`
  );
}

process.exit(0);
