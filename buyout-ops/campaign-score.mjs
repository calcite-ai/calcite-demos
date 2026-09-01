/**
 * Campaign routing scores for inside-sales PoC (HP改善 / 採用改善 / AI業務改善).
 * Rule-based only — no fabricated facts. Human confirms owner_campaign before send.
 */
import { enrichHpImproveEvidence } from "./inside-hp-signals.mjs";
import { originFromUrl } from "./site-g1-eval.mjs";

export const MIN_CAMPAIGN_SCORE = 3;

export const CAMPAIGNS = {
  hp_improve: "HP改善",
  recruit: "採用改善",
  ai_ops: "AI業務改善",
  skip: "skip",
};

const BAD_EMAIL =
  /example|exsample|sample@|test@|dummy@|wixpress|sentry|wordpress\.com|aaa@bbb|your@|xxx@|badge|@2x\.|\.(png|jpg|jpeg|gif|webp|svg|ico)(?:\?|$)/i;

export function isValidPublicEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e)) return false;
  if (BAD_EMAIL.test(e)) return false;
  return true;
}

export function assignTrack(row) {
  const status = String(row.status || "").trim();
  if (status === "BLOCKLIST" || status === "DOMAIN_HIJACK") return "skip";
  if (status === "NO_EMAIL" || status === "FETCH_FAIL") return "skip";
  if (!isValidPublicEmail(row.email)) return "skip";
  if (status === "CANDIDATE") return "buyout";
  if (status === "G1_MODERN" || status === "G1_WEAK") return "inside";
  return "skip";
}

function defectList(row) {
  const d = String(row.defects || "").trim();
  if (!d) return [];
  return d.split(/;\s*/).filter(Boolean);
}

/** HP改善スコア — defects / scan status / HTML シグナル */
export function scoreHpImprove(row, { html = "", signals = null } = {}) {
  const status = String(row.status || "").trim();
  if (status === "G1_MODERN") return { score: 0, evidence: [] };

  let score = 0;
  const evidence = enrichHpImproveEvidence(row.defects || "", { html, signals });

  for (const tag of evidence) {
    if (/SSL未整備/i.test(tag)) score += 2;
    else if (/viewport/i.test(tag)) score += 1;
    else if (/tel/i.test(tag)) score += 1;
    else if (/更新停止/i.test(tag)) score += 1;
    else if (/ワンページ|http混在|テンプレート|英語メニュー/i.test(tag)) score += 1;
  }

  if (status === "CANDIDATE") {
    score += 2;
    if (!evidence.includes("粗2点以上")) evidence.push("粗2点以上");
  } else if (status === "G1_WEAK") {
    score += 1;
    if (!evidence.includes("粗1点")) evidence.push("粗1点");
  }

  return { score, evidence: [...new Set(evidence)] };
}

const RECRUIT_PATHS = [
  "/recruit/",
  "/recruit",
  "/saiyo/",
  "/saiyo",
  "/jobs/",
  "/jobs",
  "/recruitment/",
  "/career/",
  "/employment/",
  "/採用/",
  "/jinzai/",
];

const RECRUIT_KW =
  /採用|求人|職人募集|スタッフ募集|キャリア|新卒採用|中途採用|リクルート/i;

/** 採用改善スコア — HTML + 採用パス fetch 結果 */
export function scoreRecruit({ html = "", recruitPages = [] } = {}) {
  let score = 0;
  const evidence = [];
  const text = String(html || "");

  if (recruitPages.some((p) => p.ok)) {
    score += 2;
    evidence.push(`採用URL:${recruitPages.find((p) => p.ok)?.path || ""}`);
  }

  if (RECRUIT_KW.test(text)) {
    score += 1;
    evidence.push("採用キーワード");
  }

  const staleRecruit = recruitPages.filter((p) => p.ok && p.maxYear != null && p.maxYear < 2020);
  if (staleRecruit.length) {
    score += 2;
    evidence.push(`採用ページ更新古い(${staleRecruit[0].maxYear})`);
  }

  const hasRecruitNav = RECRUIT_PATHS.some((p) =>
    new RegExp(`href=["'][^"']*${p.replace(/\//g, "\\/")}`, "i").test(text)
  );
  if (hasRecruitNav && !recruitPages.some((p) => p.ok)) {
    score += 1;
    evidence.push("採用リンクあり(深掘り要)");
  }

  // 工務店母集団
  score += 1;
  evidence.push("工務店・建設");

  return { score, evidence };
}

/** AI業務改善スコア — HP整備済 + 手作業シグナル */
export function scoreAiOps(row, { html = "", signals = null } = {}) {
  let score = 0;
  const evidence = [];
  const text = String(html || "");
  const status = String(row.status || "").trim();

  if (status === "G1_MODERN") {
    score += 2;
    evidence.push("HP整備済(G1_MODERN)");
  } else if (signals?.finalHttps && signals?.hasViewport && signals?.telCount >= 1) {
    score += 1;
    evidence.push("HP導線おおむね整備");
  }

  if (/fax|ＦＡＸ|FAX/i.test(text)) {
    score += 1;
    evidence.push("FAX表記");
  }

  if (/\.pdf["']/i.test(text) || /PDF/i.test(text)) {
    score += 1;
    evidence.push("PDF資料");
  }

  if (/見積|資料請求|無料相談|お問い合わせフォーム|form/i.test(text)) {
    score += 1;
    evidence.push("問合せ・見積導線");
  }

  if (/無料見積|現地調査|対応エリア/i.test(text)) {
    score += 1;
    evidence.push("見積・対応エリア訴求");
  }

  return { score, evidence };
}

/**
 * 推奨商材（inside トラックのみ）。閾値未満は skip。
 * 優先: recruit > ai_ops > hp_improve（同点時）
 */
export function recommendCampaign({ track, hpScore, recruitScore, aiScore, hpEvidence, recruitEvidence, aiEvidence }) {
  if (track === "buyout") {
    return {
      recommended_campaign: "hp_buyout_66k",
      campaign_evidence: (hpEvidence || []).join("; ") || "CANDIDATE",
    };
  }
  if (track === "skip") {
    return { recommended_campaign: "skip", campaign_evidence: "track=skip" };
  }

  const candidates = [];

  if (hpScore >= MIN_CAMPAIGN_SCORE) {
    candidates.push({
      id: "hp_improve",
      score: hpScore,
      evidence: hpEvidence,
    });
  }
  if (recruitScore >= MIN_CAMPAIGN_SCORE) {
    candidates.push({
      id: "recruit",
      score: recruitScore,
      evidence: recruitEvidence,
    });
  }
  if (aiScore >= MIN_CAMPAIGN_SCORE && hpScore < MIN_CAMPAIGN_SCORE) {
    candidates.push({
      id: "ai_ops",
      score: aiScore,
      evidence: aiEvidence,
    });
  }

  if (!candidates.length) {
    return {
      recommended_campaign: "skip",
      campaign_evidence: `全スコア不足(hp=${hpScore},recruit=${recruitScore},ai=${aiScore})`,
    };
  }

  const priority = { recruit: 3, ai_ops: 2, hp_improve: 1 };
  candidates.sort((a, b) => b.score - a.score || priority[b.id] - priority[a.id]);
  const best = candidates[0];

  return {
    recommended_campaign: best.id,
    campaign_evidence: (best.evidence || []).join("; "),
  };
}

export function recruitPathsForOrigin(origin) {
  const base = String(origin || "").replace(/\/$/, "");
  return RECRUIT_PATHS.map((p) => ({ path: p, url: `${base}${p}` }));
}

export function normUrl(url) {
  return String(url || "")
    .trim()
    .toLowerCase()
    .replace(/\/$/, "");
}

export function pickFetchUrl(row) {
  return String(row.final_url || row.url || "").trim();
}

export function originForRow(row) {
  return originFromUrl(pickFetchUrl(row));
}
