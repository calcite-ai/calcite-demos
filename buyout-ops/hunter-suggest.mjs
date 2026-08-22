#!/usr/bin/env node
/**
 * Suggest next Hunter targets from sales_prospects.csv (not yet in buyout leads).
 * Runs G1 site gate — モダン除外（石川型再発防止）。
 *
 * Usage:
 *   node buyout-ops/hunter-suggest.mjs
 *   node buyout-ops/hunter-suggest.mjs --limit 5
 *   node buyout-ops/hunter-suggest.mjs --limit 5 --skip-g1   # 候補列挙のみ（非推奨）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTIVE_VERTICAL } from "./vertical-config.mjs";
import { isPriorOutreachBlocked } from "./prior-outreach.mjs";
import { evaluateSiteG1, evaluateProspectListMeta } from "./site-g1-eval.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const limit = Number(process.argv.includes("--limit") ? process.argv[process.argv.indexOf("--limit") + 1] : 5);
const skipG1 = process.argv.includes("--skip-g1");

function parseCsvLines(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = [];
  let cur = "";
  let inQ = false;
  for (const c of lines[0]) {
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === "," && !inQ) {
      headers.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  headers.push(cur);
  const rows = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = [];
    cur = "";
    inQ = false;
    for (const c of lines[li]) {
      if (c === '"') {
        inQ = !inQ;
        continue;
      }
      if (c === "," && !inQ) {
        cols.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    cols.push(cur);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i] ?? "";
    });
    rows.push(obj);
  }
  return { headers, rows };
}

const leadsPath = path.join(__dirname, "demo_buyout_leads.csv");
const prospectsInOps = path.join(__dirname, "sales_prospects.csv");
const prospectsLegacy = path.join(repoRoot, "..", "sales", "knowledge", "sales_prospects.csv");
const prospectsPath = fs.existsSync(prospectsInOps)
  ? prospectsInOps
  : prospectsLegacy;

if (!fs.existsSync(prospectsPath)) {
  console.error("FAIL missing sales_prospects.csv (expected buyout-ops/sales_prospects.csv)");
  process.exit(1);
}

const leads = parseCsvLines(fs.readFileSync(leadsPath, "utf8")).rows;
const known = new Set(leads.map((r) => r.company).filter(Boolean));

const { rows: prospects } = parseCsvLines(fs.readFileSync(prospectsPath, "utf8"));

const rankScore = { S: 3, A: 2, B: 1, C: 0 };

const KOUMUTEN_INDUSTRY =
  /工務|工務店|建設会社|総合建設|建築(?!士)|工房|リフォーム|解体|型枠|塗装|屋根/i;
const NOT_KOUMUTEN_INDUSTRY = /税理士|会計|葬儀|司法|行政|士業|整骨|鍼灸/i;

function isKoumutenProspect(p) {
  const industry = p["業種"] || "";
  if (NOT_KOUMUTEN_INDUSTRY.test(industry)) return false;
  return KOUMUTEN_INDUSTRY.test(industry);
}

const prefiltered = prospects
  .filter((p) => {
    const industry = p["業種"] || "";
    if (!isKoumutenProspect(p)) return false;
    const email = p["メール"] || "";
    if (!email.includes("@")) return false;
    if (/なし|フォーム|要確認/.test(email)) return false;
    if (known.has(p["社名"])) return false;
    if (isPriorOutreachBlocked({ company: p["社名"], email: p["メール"] })) return false;
    const url = p["HP URL"] || "";
    if (!url.startsWith("http")) return false;
    const note = `${p["備考"] || ""} ${p["HP状態(詳細)"] || ""}`;
    if (/営業メール送信済|デモ.*送付済|見送り|対象外|buyout見送り|G1不合格/.test(note)) return false;
    const meta = evaluateProspectListMeta(p);
    if (meta.exclude) return false;
    return true;
  })
  .map((p) => ({
    rank: p["ランク"] || "C",
    company: p["社名"],
    email: p["メール"],
    url: p["HP URL"],
    industry: p["業種"],
    area: p["エリア"],
    score: rankScore[p["ランク"]] ?? 0,
    hook: p["営業切り口"] || "",
  }))
  .sort((a, b) => b.score - a.score);

const skippedG1 = [];

async function main() {
  const candidates = [];
  const scanLimit = skipG1 ? limit : Math.max(limit * 3, limit);

  for (const c of prefiltered.slice(0, scanLimit)) {
    if (skipG1) {
      candidates.push(c);
      if (candidates.length >= limit) break;
      continue;
    }
    const g1 = await evaluateSiteG1(c.url);
    if (!g1.pass) {
      skippedG1.push({ company: c.company, reason: g1.fails[0] });
      continue;
    }
    candidates.push(c);
    if (candidates.length >= limit) break;
  }

  if (skippedG1.length) {
    console.log("G1_SKIP (モダン除外 / サイト再確認):");
    for (const s of skippedG1) console.log(`- ${s.company}: ${s.reason}`);
    console.log("");
  }

  if (!candidates.length) {
    console.log(`RESULT none — no new ${ACTIVE_VERTICAL} hunter candidates (G1通過)`);
    process.exit(0);
  }

  console.log(`HUNTER_SUGGEST (${candidates.length}, vertical=${ACTIVE_VERTICAL}, G1=on):`);
  for (const c of candidates) {
    console.log(`- [${c.rank}] ${c.company}`);
    console.log(`  email: ${c.email}`);
    console.log(`  url: ${c.url}`);
    console.log(`  ${c.industry} / ${c.area}`);
  }
  console.log("\nNext: C0/C3/C5 人手 → verify-hunter-g1 → audit → swap → publish → CSV queued");
  console.log("  node buyout-ops/verify-hunter-g1.mjs --prospect-company \"社名\"  # queued 前必須");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
