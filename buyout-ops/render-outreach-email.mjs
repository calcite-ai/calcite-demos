#!/usr/bin/env node
/**
 * 初回メールを text/plain 用に組み立てる（URLは最終httpsのみ）。
 *
 * Usage:
 *   node buyout-ops/render-outreach-email.mjs --company "株式会社ビルドテクト"
 *
 * 出力を send_email の body にそのまま使う。
 * htmlBody は渡さない。google.com/url は出さない。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-util.mjs";
import { CALCITE_SITE, canonicalDemoUrl } from "./canonical-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const DEFECT_LINE = {
  SSL未整備:
    "サイトが https 未対応のままで、ブラウザによっては「安全ではありません」などの警告が出ます。初めて訪れたお客様が不安に感じて離脱しやすく、信頼以前に見てもらえない機会損失につながります",
  "https未整備":
    "サイトが https 未対応のままで、ブラウザによっては「安全ではありません」などの警告が出ます。初めて訪れたお客様が不安に感じて離脱しやすく、信頼以前に見てもらえない機会損失につながります",
  viewportなし:
    "スマホ表示用のviewport設定がなく、画面幅に合わせた表示になっていません。スマホで見づらい・操作しづらいと、そのまま閉じられやすく、問い合わせ前の離脱につながります",
  "tel:なし":
    "tel:リンクがないため、スマホで電話番号をタップしても発信につながりません。問い合わせしたい瞬間に電話できないと、そのまま機会損失になりやすいです",
};

function parseRoughItems(audit) {
  const m = String(audit || "").match(/粗:(.+)$/);
  const src = m ? m[1] : String(audit || "");
  return [...src.matchAll(/\(\d+\)([^;(]+)/g)].map((x) => x[1].trim()).filter(Boolean);
}

function issueLine(item, i) {
  const key = Object.keys(DEFECT_LINE).find((k) => item.startsWith(k));
  let text = key ? DEFECT_LINE[key] : null;
  if (/更新停止感/.test(item)) {
    text =
      "更新が止まっており、稼働中かどうか判断しづらい状態です。お客様からすると「いま依頼して大丈夫か」が分かりにくく、問い合わせをためらわれやすいです";
  } else if (/横スクロール|固定幅/.test(item)) {
    text =
      "スマホで横スクロールが発生しやすい表示になっています。読みづらい・操作しづらいと途中離脱が増え、問い合わせ機会を逃しやすいです";
  } else if (!text) {
    // 未登録の粗: 事実はそのまま、害の一文を足す（断定しすぎない）
    text = `${item}。このままだとお客様にとって分かりにくさや手間になり、問い合わせ前の離脱や機会損失につながりやすいです`;
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
while (issues.length < 3) issues.push("");

const region = arg("region") || "地域の工務店";
const strength = arg("strength") || "地域で施工を手がける実力がある";
const addressee = arg("addressee") || "ご担当者";

let out = mailBodyFromTemplate(tpl)
  .replaceAll("{会社名}", company)
  .replaceAll("{担当者名}", addressee)
  .replaceAll("{業種・地域}", region)
  .replaceAll("{強み1行}", strength)
  .replaceAll("{デモURL_A}", urlA)
  .replaceAll("{デモURL_B}", urlB)
  .replaceAll("{課題①}", issues[0])
  .replaceAll("{課題②}", issues[1])
  .replaceAll("{課題③}", issues[2])
  .replace(/https:\/\/(?!www\.)calcite-ai\.jp\/?/g, CALCITE_SITE)
  .replace(/\n{3,}/g, "\n\n");

if (/google\.com\/url/i.test(out)) {
  console.error("FAIL rendered body contains google.com/url");
  process.exit(1);
}

const [subjectLine, ...bodyLines] = out.split("\n");
const subject = subjectLine.replace(/^件名：/, "").trim();
const body = bodyLines.join("\n").replace(/^\n+/, "");

console.log("===SUBJECT===");
console.log(subject);
console.log("===BODY===");
console.log(body);
console.log("===SEND===");
console.log("mimeType: text/plain");
console.log("htmlBody: 渡さない");
console.log(`Web: ${CALCITE_SITE}`);
