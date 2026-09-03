/**
 * デモHP用: 御社サイトを拝見したうえでのリード文・改善点（事実ベース）。
 * defects / pay_signals は scan または audit_notes から。推測で足さない。
 */
import { humanStrengthLine, humanStrengthAudit } from "./strength-line.mjs";
import { parseRoughItems } from "./site-g1-eval.mjs";

export const AUDIT_SECTION_KICKER = "サイト改善のポイント";

const FIX_BY_DEFECT = {
  SSL未整備:
    "https（鍵マーク）で安心して閲覧できる構成にしています",
  "https未整備":
    "https（鍵マーク）で安心して閲覧できる構成にしています",
  viewportなし: "スマホでも読みやすい表示（viewport・レスポンシブ）にしています",
  "tel:なし": "電話番号をタップして発信できる導線（tel:）を入れています",
};

function defectTokens(defects) {
  return String(defects || "")
    .split(/;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildAuditDemoCopy({
  defects = "",
  pay_signals = "",
  audit_notes = "",
  company = "",
} = {}) {
  let tokens = defectTokens(defects);
  if (!tokens.length) tokens = parseRoughItems(audit_notes);

  const fixes = [];
  for (const d of tokens) {
    const key = Object.keys(FIX_BY_DEFECT).find((k) => d.startsWith(k) || d.includes(k));
    if (key && !fixes.includes(FIX_BY_DEFECT[key])) fixes.push(FIX_BY_DEFECT[key]);
    else if (/更新停止/.test(d))
      fixes.push("更新・活動中であることが伝わる情報の見せ方にしています");
  }
  if (!fixes.length) {
    fixes.push("問い合わせ・電話の導線を分かりやすく整理しています");
    fixes.push("スマホでも読みやすいレイアウトにしています");
  }
  fixes.push("お問い合わせフォームへの導線をトップから辿りやすくしています");

  const uniqFixes = [...new Set(fixes)].slice(0, 4);
  const strength = humanStrengthAudit({ pay_signals });

  const lede = company
    ? `${company}のホームページを拝見し、${strength}などがうかがえました。このデモでは、御社の強みが問い合わせにつながりやすいよう、以下の点を意識して構成しています。`
    : `御社のホームページを拝見したうえで、問い合わせにつながりやすい改善イメージをこのデモに反映しています。`;

  const fixesHtml = uniqFixes.map((t) => `<li>${t}</li>`).join("\n          ");

  return { lede, fixes: uniqFixes, fixesHtml };
}

export function injectAuditIntoHtml(html, copy) {
  return String(html || "")
    .replace(/__AUDIT_KICKER__/g, AUDIT_SECTION_KICKER)
    .replace(/Site review/g, AUDIT_SECTION_KICKER)
    .replace(/__AUDIT_LEDE__/g, copy.lede)
    .replace(/__AUDIT_FIXES_LI__/g, copy.fixesHtml);
}
