#!/usr/bin/env node
/**
 * 初回メールを text/plain + HTML（multipart）用に組み立てる。
 *
 * Usage:
 *   node buyout-ops/render-outreach-email.mjs --company "株式会社ビルドテクト"
 *
 * HTML: デモURLのみ SendGrid クリック追跡。署名 Web は clicktracking=off。
 * plain: すべて通常URL（enable_text: false のフォールバック用）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-util.mjs";
import { CALCITE_SITE, canonicalDemoUrl } from "./canonical-url.mjs";
import { outreachBodyToHtml } from "./outreach-email-html.mjs";
import { humanStrengthLine } from "./strength-line.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const DEFECT_LINE = {
  SSL未整備:
    "サイトが https 未対応のままで、ブラウザによっては「安全ではありません」などの警告が出ます。初めて訪れたお客様が不安に感じやすい状態です",
  "https未整備":
    "サイトが https 未対応のままで、ブラウザによっては「安全ではありません」などの警告が出ます。初めて訪れたお客様が不安に感じやすい状態です",
  HTTPSでない:
    "サイトが https 未対応のままで、ブラウザによっては「安全ではありません」などの警告が出ます。初めて訪れたお客様が不安に感じやすい状態です",
  viewportなし:
    "スマホ表示用のviewport設定がなく、画面幅に合わせた表示になっていません。スマホだと見づらく・操作しづらくなりやすいです",
  "tel:なし":
    "tel:リンクがないため、スマホで電話番号をタップしても発信につながりません。問い合わせしたい瞬間に一手間増えやすいです",
};

function parseRoughItems(audit) {
  const m = String(audit || "").match(/粗:(.+)$/);
  const src = m ? m[1] : String(audit || "");
  const numbered = [...src.matchAll(/\(\d+\)([^;(]+)/g)].map((x) => x[1].trim()).filter(Boolean);
  if (numbered.length) return numbered;
  // 番号なし監査メモ向け（「HTTPSでない」「更新感が弱い」など）
  return String(audit || "")
    .split(/[;／、]/)
    .map((s) => s.replace(/^再診残置:\s*/i, "").trim())
    .filter((s) => s && !/^https?:\/\//i.test(s) && s.length < 80);
}

function issueLine(item, i) {
  const raw = String(item || "").trim();
  const key = Object.keys(DEFECT_LINE).find((k) => raw.startsWith(k) || raw.includes(k));
  let text = key ? DEFECT_LINE[key] : null;

  if (/更新停止感|更新感が弱い|放置気味|更新が止ま/i.test(raw)) {
    text =
      "更新が止まって見える箇所があり、稼働中かどうか判断しづらい印象です。お客様からすると「いま依頼して大丈夫か」が分かりにくくなりやすいです";
  } else if (/横スクロール|固定幅/.test(raw)) {
    text =
      "スマホで横スクロールが発生しやすい表示になっています。読みづらい・操作しづらいと途中で閉じられやすいです";
  } else if (/古い静的|全体が古い|見た目が古い/i.test(raw)) {
    text =
      "サイト全体の見せ方が古く見えやすく、施工の実力と比べて第一印象で損をしやすい状態です";
  } else if (/導線.*tel|telあり/i.test(raw) && /古い|静的/.test(raw)) {
    text =
      "電話導線はある一方、サイト全体の見せ方が古く見えやすく、実力と比べて第一印象で損をしやすい状態です";
  } else if (!text) {
    // 未登録の粗: 事実を短く残し、害はやわらかく1文（断定しない）
    const fact = raw.replace(/[。．]+$/g, "");
    text = `${fact}。初めて訪れたお客様には、伝わりにくさや手間が増えやすいです`;
  }
  return `${["①", "②", "③"][i] || `${i + 1}.`} ${text}`;
}

function mailBodyFromTemplate(tpl) {
  const start = tpl.indexOf("件名：");
  if (start < 0) throw new Error("テンプレに 件名： がない");
  const rest = tpl.slice(start);
  const cut = rest.search(/\n# -----/);
  return (cut >= 0 ? rest.slice(0, cut) : rest).trim() + "\n";
}

const company = arg("company");
if (!company) {
  console.error("Required: --company");
  process.exit(1);
}

const { rows } = parseCsv(fs.readFileSync(path.join(__dirname, "demo_buyout_leads.csv"), "utf8"));
const row = rows.find((r) => r.company === company);
if (!row) {
  console.error(`FAIL company not in CSV: ${company}`);
  process.exit(1);
}

const urlA = canonicalDemoUrl(row.demo_url_a, "demo_url_a");
const urlB = canonicalDemoUrl(row.demo_url_b, "demo_url_b");
const tpl = fs.readFileSync(path.join(__dirname, "templates", "email_demo_buyout_1_initial.txt"), "utf8");
const issues = parseRoughItems(row.audit_notes).slice(0, 3).map(issueLine);

const region = arg("region") || "地域の工務店";
const strength = arg("strength") || humanStrengthLine({ pay_signals: row.pay_signals });
const addressee = arg("addressee") || "ご担当者";

let out = mailBodyFromTemplate(tpl)
  .replaceAll("{会社名}", company)
  .replaceAll("{担当者名}", addressee)
  .replaceAll("{業種・地域}", region)
  .replaceAll("{強み1行}", strength)
  .replaceAll("{デモURL_A}", urlA)
  .replaceAll("{デモURL_B}", urlB)
  .replaceAll("{課題①}", issues[0] || "")
  .replaceAll("{課題②}", issues[1] || "")
  .replaceAll("{課題③}", issues[2] || "")
  .replace(/https:\/\/(?!www\.)calcite-ai\.jp\/?/g, CALCITE_SITE)
  .replace(/\n{3,}/g, "\n\n")
  .replace(/\n[①②③]\s*\n/g, "\n");

if (/google\.com\/url/i.test(out)) {
  console.error("FAIL rendered body contains google.com/url");
  process.exit(1);
}

const [subjectLine, ...bodyLines] = out.split("\n");
const subject = subjectLine.replace(/^件名：/, "").trim();
const body = bodyLines.join("\n").replace(/^\n+/, "");
const html = outreachBodyToHtml(body, { urlA, urlB, calciteSite: CALCITE_SITE });

console.log("===SUBJECT===");
console.log(subject);
console.log("===BODY===");
console.log(body);
console.log("===HTML===");
console.log(html);
console.log("===SEND===");
console.log("mimeType: multipart/alternative (text/plain + text/html)");
console.log(`Web: ${CALCITE_SITE} (HTML: clicktracking=off)`);
