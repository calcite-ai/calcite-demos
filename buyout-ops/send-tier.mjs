/**
 * Inside 送信ティア（S/A/B/hold）— 刺さりやすさ優先の送信順制御。
 *
 * S: 毎日枠で最優先（痛みが具体）
 * A: 毎日枠（通常）
 * B: 月・木のみ・週2通まで（hp_improve 等）
 * hold: 送らない
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-util.mjs";
import { jstDateString } from "./send-quota.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const leadsPath = path.join(__dirname, "inside_sales_poc_leads.csv");

export const WEEKLY_B_LIMIT = 2;
export const VALID_TIERS = new Set(["S", "A", "B", "hold"]);

export function tierRank(tier) {
  return { S: 0, A: 1, B: 2, hold: 9 }[String(tier || "").trim()] ?? 9;
}

export function jstDayOfWeek(today = jstDateString()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).formatToParts(new Date(`${today}T12:00:00+09:00`));
  const w = parts.find((p) => p.type === "weekday")?.value;
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[w] ?? 0;
}

/** 月・木（JST）= hp_improve 等 B 枠の送信日 */
export function isInsideBsendDay(today = jstDateString()) {
  const dow = jstDayOfWeek(today);
  return dow === 1 || dow === 4;
}

function staleRecruitYear(evidence) {
  const m = String(evidence || "").match(/採用ページ更新古い\((\d{4})\)/);
  return m ? Number(m[1]) : null;
}

/**
 * @param {object} row — review or leads 行
 * @returns {"S"|"A"|"B"|"hold"}
 */
export function computeSendTier(row) {
  const manual = String(row.send_tier || "").trim();
  if (VALID_TIERS.has(manual)) return manual;

  const campaign = String(row.owner_campaign || row.recommended_campaign || "").trim();
  const evidence = String(row.campaign_evidence || "");
  const status = String(row.scan_status || row.status || "");
  const recruit = Number(row.recruit_score) || 0;
  const ai = Number(row.ai_score) || 0;
  const hp = Number(row.hp_score) || 0;

  if (campaign === "skip" || status === "pool_skip") return "hold";

  if (campaign === "hp_improve") {
    if (/SSL未整備/i.test(evidence) && hp >= 4) return "A";
    return "B";
  }

  if (campaign === "recruit") {
    const staleYear = staleRecruitYear(evidence);
    const hasRecruitUrl = /採用URL/i.test(evidence);
    if (recruit >= 6 || (hasRecruitUrl && staleYear != null && staleYear < 2020)) return "S";
    if (recruit >= 3) return "A";
    return "B";
  }

  if (campaign === "ai_ops") {
    const hasFax = /FAX表記/i.test(evidence);
    const hasForm = /問合せ・見積導線/i.test(evidence);
    if (ai >= 5 && hasFax && hasForm) return "S";
    if (status === "G1_MODERN" && ai >= 3) return "A";
    if (ai >= 3) return "A";
    return "B";
  }

  return "hold";
}

export function parseSentDate(row) {
  if (row.sent_at) return String(row.sent_at).slice(0, 10);
  const m = String(row.notes || "").match(/初回送信\s+(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

/** JST 週（月曜始まり）の YYYY-MM-DD */
export function jstWeekStart(today = jstDateString()) {
  const dow = jstDayOfWeek(today);
  const back = dow === 0 ? 6 : dow - 1;
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - back);
  return dt.toISOString().slice(0, 10);
}

export function countInsideBTierSentThisWeek(today = jstDateString()) {
  if (!fs.existsSync(leadsPath)) return 0;
  const weekStart = jstWeekStart(today);
  const { rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
  return rows.filter((r) => {
    if (r.status !== "sent") return false;
    const tier = String(r.send_tier || computeSendTier(r)).trim();
    if (tier !== "B") return false;
    const sent = parseSentDate(r);
    return sent && sent >= weekStart && sent <= today;
  }).length;
}

export function weeklyBRemaining(today = jstDateString()) {
  return Math.max(0, WEEKLY_B_LIMIT - countInsideBTierSentThisWeek(today));
}

/**
 * 今日の inside 送信候補（S/A 優先。S がいれば S のみ。なければ A。B は月木かつ週枠あり時のみ）
 */
export function pickInsideSendCandidates(rows, { today = jstDateString() } = {}) {
  const withTier = rows.map((r) => ({
    ...r,
    send_tier: String(r.send_tier || computeSendTier(r)).trim(),
  }));

  const s = withTier.filter((r) => r.send_tier === "S");
  const a = withTier.filter((r) => r.send_tier === "A");
  const b = withTier.filter((r) => r.send_tier === "B");

  if (s.length) return { pool: s, mode: "daily_sa", weekly_b_remaining: weeklyBRemaining(today) };
  if (a.length) return { pool: a, mode: "daily_sa", weekly_b_remaining: weeklyBRemaining(today) };

  if (isInsideBsendDay(today) && weeklyBRemaining(today) > 0 && b.length) {
    return { pool: b, mode: "weekly_b", weekly_b_remaining: weeklyBRemaining(today) };
  }

  return { pool: [], mode: "none", weekly_b_remaining: weeklyBRemaining(today) };
}
