#!/usr/bin/env node
/**
 * 士業候補リスト（candidates/shigyo_merged_*.csv）の1行から、
 * designs/swap-shigyo.mjs の実行コマンドを組み立てて表示する。
 * 値は候補CSV（調査エージェントが先方HPで確認した値）からそのまま写す。手で打ち直さない。
 *
 * Usage:
 *   node buyout-ops/shigyo-swap-cmd.mjs --rank 1
 *   node buyout-ops/shigyo-swap-cmd.mjs --company "本多行政書士事務所"
 *   node buyout-ops/shigyo-swap-cmd.mjs --rank 1 --file buyout-ops/candidates/shigyo_merged_20261117.csv
 *
 * 出力のコマンドを実行する前に、risk_notes（同定の注意・稼働の裏付け）を読むこと。
 * このスクリプトは CSV に何も書かない。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function arg(name, fb = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fb;
}

const dir = path.join(__dirname, "candidates");
const file =
  arg("file") ||
  path.join(
    dir,
    fs.readdirSync(dir).filter((f) => /^shigyo_merged_\d+\.csv$/.test(f)).sort().pop() || ""
  );
if (!fs.existsSync(file)) {
  console.error("FAIL 候補CSVが無い:", file);
  process.exit(1);
}
const { rows } = parseCsv(fs.readFileSync(file, "utf8"));
const rank = arg("rank");
const company = arg("company");
const r = rows.find((x) => (rank ? x.rank === rank : company ? (x.company || "").includes(company) : false));
if (!r) {
  console.error("FAIL 該当行なし。--rank か --company を指定");
  process.exit(1);
}

const q = (s) => `"${String(s).replace(/(["\\$`])/g, "\\$1")}"`;
const services = String(r.services || "")
  .split(/[、，]/)
  .map((s) => s.trim())
  .filter(Boolean)
  .slice(0, 8);
const creds = String(r.profession || "")
  .replace(/（[^）]*）/g, "") // 「行政書士（保育士）」のような副業注記は資格欄に出さない
  .split(/[・,、]/)
  .map((s) => s.trim())
  .filter(Boolean);
const slug = arg("slug") || "";

const parts = [
  "node buyout-template/designs/swap-shigyo.mjs",
  `--slug ${slug || "<ローマ字スラッグ>"}`,
  `--name ${q(r.company)}`,
  creds.length ? `--credentials ${q(creds.join(","))}` : "",
  `--services ${q(services.join("|"))}`,
  `--tel ${q(r.tel)}`,
  `--address ${q(r.address)}`,
  r.email ? `--email ${q(r.email)}` : "",
  r.business_hours ? `--hours ${q(r.business_hours)}` : "",
  r.representative ? `--row ${q("代表者=" + r.representative)}` : "",
  r.reg_no ? `--row ${q("登録番号=" + r.reg_no)}` : "",
].filter(Boolean);

console.log(`# rank ${r.rank} ${r.company}（${r.prefecture}）flag=${r.flag}`);
console.log(`# defects_verified: ${r.defects_verified}`);
console.log(`# risk_notes: ${r.risk_notes}`);
console.log(`# site_url: ${r.site_url}`);
console.log(parts.join(" \\\n  "));
