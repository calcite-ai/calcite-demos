#!/usr/bin/env node
/**
 * 士業（行政書士・司法書士・社労士・税理士・土地家屋調査士）向けデモを生成する。
 * 工務店向けの swap-prospect.mjs（e-taisei）の士業版。写真は使わず、先方HPの事実だけを載せる。
 *
 * Usage:
 *   node designs/swap-shigyo.mjs \
 *     --slug sample-office \
 *     --name "山田行政書士事務所" \
 *     --credentials "行政書士,社会保険労務士" \        # 先方HPが名乗っている資格だけ
 *     --services "建設業許可|遺言・相続手続き|会社設立" \  # 先方HPの業務見出し（|区切り、1〜8件）
 *     --tel "03-1234-5678" --address "〒150-0001 東京都渋谷区…" \
 *     [--email info@example.jp] [--hours "平日 9:00-18:00"] \
 *     [--lead "先方HPにある一文"] \
 *     --row "代表者=山田 太郎" --row "登録番号=第123456号"   # 先方HPに「書いてある」行だけ。何度でも指定可
 *
 * Output: designs/_prospects/<slug>/g-shigyo/   （--out で出力先を変更可）
 * 次: node designs/publish-prospect.mjs --slug <slug>   （works/<slug>/ へ。スキン階層は畳まれる）
 *
 * 代表者名・登録番号は、先方HPの原文に literal で存在することを確認してから渡すこと。
 * 渡さなかった項目は行ごと出ない。空欄は「ご購入後」の約束にする。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderSite } from "./g-shigyo/pages.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKIN = "g-shigyo";

function args(name) {
  const out = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === `--${name}` && process.argv[i + 1] !== undefined) out.push(process.argv[i + 1]);
  }
  return out;
}
const arg = (name, fallback = "") => args(name)[0] ?? fallback;
const flag = (name) => process.argv.includes(`--${name}`);

function die(msg) {
  console.error("FAIL", msg);
  process.exit(1);
}

let ctx;
if (flag("sample")) {
  // 見た目確認用の架空データ。実在事務所の名前は使わない
  ctx = {
    name: "サンプル行政書士事務所",
    credentials: ["行政書士"],
    lead: "",
    tel: "03-0000-0000",
    email: "info@example.com",
    address: "〒100-0001 東京都千代田区サンプル1-2-3",
    hours: "",
    services: ["サンプル業務A", "サンプル業務B", "サンプル業務C"],
    rows: [["代表者", "サンプル 太郎"]],
  };
} else {
  const name = arg("name");
  const tel = arg("tel");
  const address = arg("address");
  const services = arg("services")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!name) die("Required: --name");
  if (!tel) die("Required: --tel");
  if (!address) die("Required: --address");
  if (!services.length) die("Required: --services（先方HPの業務見出しを | 区切りで1〜8件。推測で埋めない）");
  if (services.length > 8) die("--services は8件まで");
  const rows = args("row").map((r) => {
    const i = r.indexOf("=");
    if (i < 1) die(`--row は "ラベル=値" 形式: ${r}`);
    return [r.slice(0, i).trim(), r.slice(i + 1).trim()];
  });
  ctx = {
    name,
    credentials: arg("credentials")
      .split(/[,、，]/)
      .map((s) => s.trim())
      .filter(Boolean),
    lead: arg("lead"),
    tel,
    email: arg("email"),
    address,
    hours: arg("hours"),
    services,
    rows: rows.filter(([, v]) => v),
  };
}

const slug = arg("slug", flag("sample") ? "_sample-shigyo" : "");
if (!slug && !arg("out")) die("Required: --slug");
const outRoot = arg("out") ? path.resolve(arg("out")) : path.join(__dirname, "_prospects", slug);
const dest = path.join(outRoot, SKIN);

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

for (const [rel, html] of Object.entries(renderSite(ctx))) {
  const file = path.join(dest, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}
for (const f of ["styles.css", "site.js"]) {
  fs.copyFileSync(path.join(__dirname, SKIN, f), path.join(dest, f));
}

console.log("ready", dest);
console.log("Next: node designs/publish-prospect.mjs --slug " + slug);
