#!/usr/bin/env node
/**
 * Overnight prospect scanner — 送信しない。種URLを G0/G1 機械判定して pipeline CSV へ。
 * C1: 種が http でも https を試し、通れば defects に SSL未整備を付けない（site-g1-eval）。
 *
 * Usage:
 *   node buyout-ops/extract-seeds-from-prospects.mjs --merge
 *   caffeinate -i node buyout-ops/prospect-scan-batch.mjs
 *   node buyout-ops/prospect-scan-batch.mjs --limit 20 --sleep-ms 2500
 *
 * Output: buyout-ops/prospect_pipeline/scan_results.csv
 *   status=CANDIDATE → 朝イチで C0/C3 人手確認 → sales_prospects へ
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateModernExclusion,
  detectMachineDefects,
  formatRoughAudit,
  fetchSiteWithContacts,
  isBuyoutCandidateDefects,
} from "./site-g1-eval.mjs";
import { isPriorOutreachBlocked } from "./prior-outreach.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const seedPath = path.resolve(__dirname, arg("seed", "seeds/koumuten_urls.csv"));
const outDir = path.join(__dirname, "prospect_pipeline");
const outPath = path.join(outDir, "scan_results.csv");
const limit = Number(arg("limit", "0")) || Infinity;
const sleepMs = Number(arg("sleep-ms", "2000"));
const vertical = arg("vertical", "koumuten");

const OUT_FIELDS =
  "scanned_at,vertical,company,url,prefecture,source,status,email,defects,audit_draft,final_url,notes".split(
    ","
  );

const OUT_HEADER = `${OUT_FIELDS.join(",")}\n`;

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = [];
    let cur = "";
    let inQ = false;
    for (const c of line) {
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
    const o = {};
    headers.forEach((h, i) => {
      o[h] = (cols[i] ?? "").trim();
    });
    return o;
  });
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function serializeRow(obj) {
  return OUT_FIELDS.map((h) => csvEscape(obj[h])).join(",");
}

function normUrl(url) {
  return String(url || "")
    .trim()
    .toLowerCase()
    .replace(/\/$/, "");
}

function loadScannedUrls() {
  if (!fs.existsSync(outPath)) return new Set();
  const rows = parseCsv(fs.readFileSync(outPath, "utf8"));
  return new Set(rows.map((r) => normUrl(r.url)).filter(Boolean));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function scanOne(seed) {
  const { company, url, prefecture, source } = seed;
  const ts = new Date().toISOString().slice(0, 19);
  const base = {
    scanned_at: ts,
    vertical,
    company,
    url,
    prefecture: prefecture || "",
    source: source || "",
    email: "",
    defects: "",
    audit_draft: "",
    final_url: "",
    notes: "",
    status: "",
  };

  if (isPriorOutreachBlocked({ company, email: "" })) {
    return { ...base, status: "BLOCKLIST", notes: "prior_outreach_blocklist（社名）" };
  }

  let pack;
  try {
    pack = await fetchSiteWithContacts(url);
  } catch (e) {
    return { ...base, status: "FETCH_FAIL", notes: e.message };
  }

  if (!pack.signals || pack.signals.status !== 200) {
    return { ...base, status: "FETCH_FAIL", notes: "HTTP error" };
  }

  const modern = evaluateModernExclusion(pack.signals);
  if (modern.exclude) {
    return {
      ...base,
      status: "G1_MODERN",
      email: pack.emails[0] || "",
      final_url: pack.signals.finalUrl,
      notes: modern.message,
    };
  }

  const email = pack.emails[0] || "";
  if (!email) {
    return {
      ...base,
      status: "NO_EMAIL",
      final_url: pack.signals.finalUrl,
      notes: "公開メールなし（フォームのみ）",
    };
  }

  if (isPriorOutreachBlocked({ company, email })) {
    return {
      ...base,
      status: "BLOCKLIST",
      email,
      final_url: pack.signals.finalUrl,
      notes: "blocklist email",
    };
  }

  const defects = detectMachineDefects(pack.signals);
  const auditDraft = formatRoughAudit(defects);

  if (!isBuyoutCandidateDefects(defects)) {
    return {
      ...base,
      status: "G1_WEAK",
      email,
      defects: defects.join("; "),
      audit_draft: auditDraft,
      final_url: pack.signals.finalUrl,
      notes: `粗${defects.length}点のみ — 捏造禁止・見送り`,
    };
  }

  return {
    ...base,
    status: "CANDIDATE",
    email,
    defects: defects.join("; "),
    audit_draft: auditDraft,
    final_url: pack.signals.finalUrl,
    notes: "朝: C0+C3人手 → verify-hunter-g1 → sales_prospects",
  };
}

async function main() {
  if (!fs.existsSync(seedPath)) {
    console.error(`FAIL missing seed file: ${seedPath}`);
    console.error("Run: node buyout-ops/extract-seeds-from-prospects.mjs --merge");
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const scanned = loadScannedUrls();
  const seeds = parseCsv(fs.readFileSync(seedPath, "utf8")).filter((s) => s.url?.startsWith("http"));

  if (!fs.existsSync(outPath)) fs.writeFileSync(outPath, OUT_HEADER);

  let n = 0;
  let candidates = 0;
  const stats = {};

  console.log(`=== prospect-scan-batch (vertical=${vertical}, sleep=${sleepMs}ms) ===`);
  console.log(`seeds: ${seeds.length}, already scanned: ${scanned.size}\n`);

  for (const seed of seeds) {
    const seedKey = normUrl(seed.url);
    if (scanned.has(seedKey)) continue;
    if (n >= limit) continue;

    process.stdout.write(`scan ${seed.company} … `);
    // Hard ceiling so one sticky host cannot stall the whole batch
    // (AbortSignal on fetch alone is not always enough for hung sockets).
    const result = await Promise.race([
      scanOne(seed),
      sleep(90000).then(() => ({
        scanned_at: new Date().toISOString().slice(0, 19),
        vertical,
        company: seed.company,
        url: seed.url,
        prefecture: seed.prefecture || "",
        source: seed.source || "",
        email: "",
        defects: "",
        audit_draft: "",
        final_url: "",
        notes: "scan_hard_timeout_90s",
        status: "FETCH_FAIL",
      })),
    ]);
    fs.appendFileSync(outPath, serializeRow(result) + "\n");
    scanned.add(seedKey);

    stats[result.status] = (stats[result.status] || 0) + 1;
    if (result.status === "CANDIDATE") candidates++;
    console.log(result.status);

    n++;
    if (sleepMs > 0) await sleep(sleepMs);
  }

  console.log(`\nRESULT scanned=${n} new_candidates=${candidates}`);
  console.log("by status:", stats);
  console.log(`output: ${outPath}`);
  console.log("\nMorning: filter status=CANDIDATE → C0/C3 → verify-hunter-g1 → merge sales_prospects");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
