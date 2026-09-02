#!/usr/bin/env node
/**
 * インサイド初回メール text/plain 生成。
 *
 * Usage: node buyout-ops/render-inside-email.mjs --company "矢島工務店"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-util.mjs";
import { CALCITE_SITE } from "./canonical-url.mjs";
import { hpImproveObservationLines, hpImproveStrengthLine } from "./inside-hp-signals.mjs";
import { fixIdeaLines, formatBulletBlock } from "./inside-fix-ideas.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const RECRUIT_LINES = {
  "採用ページ更新古い": (y) =>
    `採用ページの更新が ${y ? y + "年" : "以前"} あたりで止まっており、「いま募集しているか」が判断しづらい`,
  採用URL: () => "採用・求人のページはあるものの、応募までの流れが少し分かりにくい",
  採用キーワード: () =>
    "採用への言及はある一方、働くイメージや募集状況が、施工実績ほどには伝わりにくい",
  "採用リンクあり": () => "メニューに採用リンクはあるものの、中身が薄く応募判断がしづらい",
};

const AIOPS_LINES = {
  FAX表記: () => "FAX番号も併記されており、Web経由の問い合わせと社内処理が分かれやすい",
  PDF資料: () => "PDF資料が中心で、内容更新のたびに差し替えの手間がかかりやすい",
  "問合せ・見積導線": () => "問い合わせ・見積の導線はある一方、受付後の確認・返信に手が回りにくい",
  "見積・対応エリア訴求": () => "対応エリアや無料見積の案内があり、問い合わせのたびにエリア確認が発生しやすい",
  "HP整備済": () => "ホームページ自体は整っている一方、問い合わせ以降の運用負荷が残りやすい",
  "HP導線おおむね整備": () => "サイトの導線はおおむね整っている一方、受付後の業務に手作業が残りやすい",
};

function staleYear(evidence) {
  const m = evidence.match(/採用ページ更新古い\((\d{4})\)/);
  return m ? m[1] : "";
}

function observationLines(campaign, evidence) {
  if (campaign === "hp_improve") {
    return hpImproveObservationLines(evidence);
  }

  const max = campaign === "recruit" ? 3 : 2;
  const parts = String(evidence || "").split(/;\s*/).filter(Boolean);
  const map = campaign === "recruit" ? RECRUIT_LINES : AIOPS_LINES;
  const lines = [];
  for (const p of parts) {
    for (const [key, fn] of Object.entries(map)) {
      if (p.includes(key) && lines.length < max) {
        const line = key === "採用ページ更新古い" ? fn(staleYear(p)) : fn();
        if (!lines.includes(line)) lines.push(line);
      }
    }
  }
  while (lines.length < Math.min(2, max)) {
    lines.push(
      campaign === "recruit"
        ? "応募者向けの情報（働くイメージ・募集状況）が、施工実績ほどには伝わりにくい"
        : "問い合わせ内容の整理・返信に、電話やFAXなど複数チャネルが混在しやすい"
    );
  }
  const marks = ["①", "②", "③"];
  return lines.slice(0, max).map((t, i) => `${marks[i]} ${t}`);
}

function strengthLine(campaign, evidence) {
  if (campaign === "hp_improve") return hpImproveStrengthLine(evidence);
  if (campaign === "recruit") return "施工の実力や事業内容は伝わる";
  return "お問い合わせ・見積の導線は整っている";
}

function mailBodyFromTemplate(tpl) {
  const start = tpl.indexOf("件名：");
  if (start < 0) throw new Error("テンプレに 件名： がない");
  const rest = tpl.slice(start);
  // 社内メモ（# -----）のみ除去。署名の ━━━ 行は本文に含める（buyout と同じ）
  const cut = rest.search(/\n# -----/);
  return (cut >= 0 ? rest.slice(0, cut) : rest).trim() + "\n";
}

const company = arg("company");
if (!company) {
  console.error("Required: --company");
  process.exit(1);
}

const { rows } = parseCsv(fs.readFileSync(path.join(__dirname, "inside_sales_poc_leads.csv"), "utf8"));
const row = rows.find((r) => r.company === company);
if (!row) {
  console.error(`FAIL company not in inside_sales_poc_leads.csv: ${company}`);
  process.exit(1);
}

const campaign = String(row.owner_campaign || row.recommended_campaign || "").trim();
if (!["recruit", "ai_ops", "hp_improve"].includes(campaign)) {
  console.error(`FAIL campaign must be recruit, ai_ops, or hp_improve: ${campaign}`);
  process.exit(1);
}

const tplByCampaign = {
  recruit: "email_inside_recruit_1_initial.txt",
  ai_ops: "email_inside_ai_ops_1_initial.txt",
  hp_improve: "email_inside_hp_improve_1_initial.txt",
};
const tpl = fs.readFileSync(path.join(__dirname, "templates", tplByCampaign[campaign]), "utf8");
const evidence = row.campaign_evidence || "";
const obs = observationLines(campaign, evidence);
const prefecture = row.prefecture || "地域";
const strength = strengthLine(campaign, evidence);
const fixBlock = formatBulletBlock(fixIdeaLines(campaign, evidence));

let out = mailBodyFromTemplate(tpl)
  .replaceAll("{会社名}", company)
  .replaceAll("{担当者名}", arg("addressee") || "ご担当者")
  .replaceAll("{都道府県}", prefecture)
  .replaceAll("{強み1行}", strength)
  .replaceAll("{具体策ブロック}", fixBlock)
  .replaceAll("{観察①}", obs[0] || "")
  .replaceAll("{観察②}", obs[1] || "")
  .replaceAll("{観察③}", obs[2] || "");

out = out
  .replace(/https:\/\/(?!www\.)calcite-ai\.jp\/?/g, CALCITE_SITE)
  .replace(/\n{3,}/g, "\n\n")
  // 観察が2件だけのとき、空の③行を落とす
  .replace(/\n③\s*\n/g, "\n");

const [subjectLine, ...bodyLines] = out.split("\n");
const subject = subjectLine.replace(/^件名：/, "").trim();
const body = bodyLines.join("\n").replace(/^\n+/, "");

console.log("===SUBJECT===");
console.log(subject);
console.log("===BODY===");
console.log(body);
console.log("===SEND===");
console.log("mimeType: text/plain");
console.log(`campaign: ${campaign}`);
