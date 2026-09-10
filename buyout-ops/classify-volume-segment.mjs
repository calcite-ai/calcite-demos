#!/usr/bin/env node
/**
 * 「ボリューム型」判定 — コンテンツは活発に更新されているが技術的な粗がある会社を検出する。
 * 2026-09-10 オーナー承認: 66,000円即決オファーが刺さりにくい規模の会社向けに、
 * email_demo_buyout_1_initial_volume.txt（見積もり制・全面差し替え）を使う対象を選ぶ。
 *
 * Usage:
 *   node buyout-ops/classify-volume-segment.mjs --url https://example.com/
 *
 * 判定はあくまで機械的な下見。最終判断は現行の通り人手（C0/C3と同じ扱い）。
 * ここでVOLUMEになっても、{創業年数}/{コンテンツ種別}は実HPを読んで手で埋める
 * （捏造禁止。テンプレ側のコメント参照）。
 *
 * Exit 0 = 判定完了（RESULT VOLUME / RESULT STANDARD どちらでも0。CIゲートではない）。
 * Exit 1 = 取得失敗。
 */
import { fetchSiteSignals } from "./site-g1-eval.mjs";

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const url = arg("url");
if (!url) {
  console.error("Required: --url");
  process.exit(1);
}

/** サイト内リンク数（同一オリジンのみ）— ページ・コンテンツ量の粗い代理指標 */
function countInternalLinks(html, origin) {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const internal = new Set();
  for (const h of hrefs) {
    if (h.startsWith("#") || h.startsWith("mailto:") || h.startsWith("tel:")) continue;
    if (h.startsWith("/") || h.includes(origin.replace(/^https?:\/\//, ""))) {
      internal.add(h.split("#")[0]);
    }
  }
  return internal.size;
}

/** ブログ・お知らせ・イベント・事例など「活発な更新」を示す語の出現 */
const CONTENT_WORDS = [
  "ブログ",
  "お知らせ",
  "イベント",
  "事例",
  "施工事例",
  "実績",
  "コラム",
  "見学会",
  "セミナー",
  "お客様の声",
];
function countContentWordHits(html) {
  const text = html.replace(/<[^>]+>/g, " ");
  let hitKinds = 0;
  for (const w of CONTENT_WORDS) {
    if (text.includes(w)) hitKinds++;
  }
  return hitKinds;
}

/** 創業/設立年（西暦・和暦の粗い抽出。精度は低いので参考値どまり） */
const ERA_BASE = { 明治: 1867, 大正: 1911, 昭和: 1925, 平成: 1988, 令和: 2018 };
function extractFoundingYear(html) {
  const text = html.replace(/<[^>]+>/g, " ");
  const western = text.match(/創業[^\d]{0,4}(\d{4})年/) || text.match(/設立[^\d]{0,4}(\d{4})年/);
  if (western) return +western[1];
  const era = text.match(/創業[^\S\n]{0,4}(明治|大正|昭和|平成|令和)(\d{1,2}|元)年/);
  if (era) {
    const [, name, n] = era;
    const num = n === "元" ? 1 : +n;
    return ERA_BASE[name] + num;
  }
  return null;
}

async function main() {
  const signals = await fetchSiteSignals(url);
  const origin = new URL(signals.finalUrl).origin;

  const currentYear = new Date().getFullYear();
  const recentContent = signals.maxYear !== null && signals.maxYear >= currentYear - 1;
  const linkCount = countInternalLinks(signals.html, origin);
  const manyPages = linkCount >= 40;
  const contentWordKinds = countContentWordHits(signals.html);
  const richContent = contentWordKinds >= 3;
  const foundingYear = extractFoundingYear(signals.html);
  const oldCompany = foundingYear !== null && currentYear - foundingYear >= 30;

  const score = [recentContent, manyPages, richContent, oldCompany].filter(Boolean).length;
  const verdict = score >= 2 ? "VOLUME" : "STANDARD";

  console.log(`=== classify-volume-segment: ${url} ===`);
  console.log(`signals: recentContent=${recentContent}(maxYear=${signals.maxYear}) manyPages=${manyPages}(links=${linkCount}) richContent=${richContent}(kinds=${contentWordKinds}/10) oldCompany=${oldCompany}(founded=${foundingYear ?? "不明"})`);
  console.log(`score: ${score}/4`);
  console.log(`RESULT ${verdict} — ${verdict === "VOLUME" ? "email_demo_buyout_1_initial_volume.txt を検討（最終判断は人手）" : "標準型（email_demo_buyout_1_initial.txt）のまま"}`);
}

main().catch((e) => {
  console.error("FETCH FAIL", e.message || e);
  process.exit(1);
});
