#!/usr/bin/env node
/**
 * G1 gate — Hunter / queued 投入前の必須チェック（石川型再発防止）。
 *
 * Usage:
 *   node buyout-ops/verify-hunter-g1.mjs --url https://example.com/
 *   node buyout-ops/verify-hunter-g1.mjs --from-csv --company "株式会社〇〇"
 *   node buyout-ops/verify-hunter-g1.mjs --from-csv --queued
 *
 * Exit 0 = G1 PASS. Non-zero = do not queue / do not hunt.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateSiteG1,
  evaluateLeadG1,
  evaluateProspectListMeta,
  evaluateAuditNotes,
} from "./site-g1-eval.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
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
  return rows;
}

async function checkUrl(url) {
  console.log(`\n=== G1 site: ${url} ===`);
  const r = await evaluateSiteG1(url);
  if (r.pass) {
    console.log("RESULT PASS — ok to hunt (C0/C3/C5 は人手)");
    if (r.signals?.maxYear) console.log(`  signals: https=${r.signals.finalHttps} viewport=${r.signals.hasViewport} tel=${r.signals.telCount} maxYear=${r.signals.maxYear}`);
    return true;
  }
  for (const f of r.fails) console.log("FAIL", f);
  console.log("RESULT FAIL — do not queue (Hunter§5 モダン除外)");
  return false;
}

async function checkLead(row, { asQueued = false } = {}) {
  console.log(`\n=== G1 lead: ${row.company} ===`);
  const r = await evaluateLeadG1({
    site_url: row.site_url,
    audit_notes: row.audit_notes,
    status: row.status || "queued",
    asQueued,
  });
  if (r.pass) {
    console.log("RESULT PASS — ok to queue/send (G1)");
    return true;
  }
  for (const f of r.fails) console.log("FAIL", f);
  console.log("RESULT FAIL — do not queue/send");
  return false;
}

async function main() {
  const url = arg("url");
  if (url) {
    process.exit((await checkUrl(url)) ? 0 : 1);
  }

  if (hasFlag("from-csv")) {
    const csvPath = path.join(__dirname, "demo_buyout_leads.csv");
    const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
    const company = arg("company");
    let targets = [];
    if (hasFlag("queued")) {
      targets = rows.filter((r) => r.status === "queued" || r.status === "built");
    } else if (company) {
      targets = rows.filter((r) => (r.company || "").includes(company));
      // paused な重複行（例: finfo@ 誤抽出）が queued 送信をブロックしない
      const active = targets.filter((r) =>
        ["queued", "built", "approved"].includes(String(r.status || ""))
      );
      if (active.length) targets = active;
    } else {
      console.error("Need --url, or --from-csv with --company or --queued");
      process.exit(2);
    }
    if (!targets.length) {
      console.log("No targets");
      process.exit(0);
    }
    let ok = true;
    const asQueued = Boolean(company) && !hasFlag("queued");
    for (const t of targets) {
      if (!(await checkLead(t, { asQueued }))) ok = false;
    }
    process.exit(ok ? 0 : 1);
  }

  // prospects meta + optional site from --prospect-company
  const prospectCo = arg("prospect-company");
  if (prospectCo) {
    const pPath = path.join(__dirname, "sales_prospects.csv");
    const prospects = parseCsv(fs.readFileSync(pPath, "utf8"));
    const p = prospects.find((r) => (r["社名"] || "").includes(prospectCo));
    if (!p) {
      console.error(`No prospect: ${prospectCo}`);
      process.exit(2);
    }
    const meta = evaluateProspectListMeta(p);
    if (meta.exclude) {
      console.log("FAIL", meta.message);
      process.exit(1);
    }
    const siteUrl = p["HP URL"];
    process.exit((await checkUrl(siteUrl)) ? 0 : 1);
  }

  console.error(`Usage:
  node buyout-ops/verify-hunter-g1.mjs --url <site>
  node buyout-ops/verify-hunter-g1.mjs --from-csv --company "…"
  node buyout-ops/verify-hunter-g1.mjs --from-csv --queued
  node buyout-ops/verify-hunter-g1.mjs --prospect-company "…"`);
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
