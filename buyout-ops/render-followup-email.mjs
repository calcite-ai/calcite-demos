#!/usr/bin/env node
/**
 * 未返信フォロー（2通目）を text/plain + HTML（multipart）用に組み立てる。
 * 対象は status=sent の既存リード。新しいデモは作らない。
 *
 * Usage:
 *   node buyout-ops/render-followup-email.mjs --company "村上工務店"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-util.mjs";
import { CALCITE_SITE, canonicalDemoUrl } from "./canonical-url.mjs";
import { outreachBodyToHtml } from "./outreach-email-html.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function mailBodyFromTemplate(tpl) {
  const start = tpl.indexOf("件名：");
  if (start < 0) throw new Error("テンプレに 件名： がない");
  const rest = tpl.slice(start);
  const cut = rest.search(/\n# -----/);
  return (cut >= 0 ? rest.slice(0, cut) : rest).trim() + "\n";
}

function noteField(notes, key) {
  const m = String(notes || "").match(new RegExp(`${key}[：:]([^|]+)`));
  return m ? m[1].trim() : "";
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
const tpl = fs.readFileSync(
  path.join(__dirname, "templates", "email_demo_buyout_5_followup.txt"),
  "utf8"
);

// 初回件名は email_demo_buyout_1_initial.txt と同じ固定フォーマット（1通目の件名生成と揃える）
const initialSubject = `${company}様のサイトを拝見し、改善イメージのたたき台をお作りしました`;
const addressee = arg("addressee") || noteField(row.notes, "宛名") || "ご担当者";

let out = mailBodyFromTemplate(tpl)
  .replaceAll("{初回の件名}", initialSubject)
  .replaceAll("{担当者名}", addressee)
  .replaceAll("{デモURL_A}", urlA)
  .replace(/https:\/\/(?!www\.)calcite-ai\.jp\/?/g, CALCITE_SITE)
  .replace(/\n{3,}/g, "\n\n");

if (/google\.com\/url/i.test(out)) {
  console.error("FAIL rendered body contains google.com/url");
  process.exit(1);
}

const [subjectLine, ...bodyLines] = out.split("\n");
const subject = subjectLine.replace(/^件名：/, "").trim();
const body = bodyLines.join("\n").replace(/^\n+/, "");
const html = outreachBodyToHtml(body, { urlA, urlB: "", calciteSite: CALCITE_SITE });

console.log("===SUBJECT===");
console.log(subject);
console.log("===BODY===");
console.log(body);
console.log("===HTML===");
console.log(html);
console.log("===SEND===");
console.log("mimeType: multipart/alternative (text/plain + text/html)");
console.log(`Web: ${CALCITE_SITE} (HTML: clicktracking=off)`);
