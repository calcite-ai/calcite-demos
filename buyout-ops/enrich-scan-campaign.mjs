#!/usr/bin/env node
/**
 * 第2パス: scan_results の inside 候補（+ buyout参考）に採用/AIシグナルを付与。
 * Output: prospect_pipeline/campaign_scores.csv
 *
 * Usage:
 *   node buyout-ops/enrich-scan-campaign.mjs
 *   node buyout-ops/enrich-scan-campaign.mjs --sleep-ms 1500 --limit 20
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";
import { fetchSiteSignals } from "./site-g1-eval.mjs";
import {
  assignTrack,
  normUrl,
  originForRow,
  pickFetchUrl,
  recommendCampaign,
  recruitPathsForOrigin,
  scoreAiOps,
  scoreHpImprove,
  scoreRecruit,
} from "./campaign-score.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scanPath = path.join(__dirname, "prospect_pipeline", "scan_results.csv");
const outPath = path.join(__dirname, "prospect_pipeline", "campaign_scores.csv");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const sleepMs = Number(arg("sleep-ms", "1200")) || 0;
const limit = Number(arg("limit", "0")) || Infinity;
const force = process.argv.includes("--force");

const OUT_HEADERS = [
  "url",
  "company",
  "scan_status",
  "track",
  "email",
  "prefecture",
  "final_url",
  "hp_score",
  "recruit_score",
  "ai_score",
  "recommended_campaign",
  "campaign_evidence",
  "enriched_at",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadExisting() {
  const map = new Map();
  if (!fs.existsSync(outPath)) return map;
  for (const r of parseCsv(fs.readFileSync(outPath, "utf8")).rows) {
    const k = normUrl(r.url);
    if (k) map.set(k, r);
  }
  return map;
}

async function fetchRecruitPages(origin, html) {
  const hinted = [];
  for (const { path: p, url } of recruitPathsForOrigin(origin)) {
    if (new RegExp(`href=["'][^"']*${p.replace(/\//g, "\\/")}`, "i").test(html || "")) {
      hinted.push({ path: p, url });
    }
  }
  const fallback = ["/recruit/", "/saiyo/", "/jobs/", "/採用/"].map((p) => ({
    path: p,
    url: `${String(origin).replace(/\/$/, "")}${p}`,
  }));
  const toTry = (hinted.length ? hinted : fallback).slice(0, 4);

  const pages = [];
  for (const { path: p, url } of toTry) {
    try {
      const s = await fetchSiteSignals(url);
      if (s.status === 200) {
        const years = [...s.html.matchAll(/20[0-9]{2}/g)]
          .map((m) => +m[0])
          .filter((y) => y >= 2000 && y <= 2030);
        pages.push({
          path: p,
          ok: true,
          maxYear: years.length ? Math.max(...years) : null,
          html: s.html,
        });
        break;
      }
    } catch {
      /* skip */
    }
  }
  return pages;
}

async function enrichRow(row) {
  const track = assignTrack(row);
  let html = "";
  let signals = null;
  let recruitPages = [];

  if (track === "inside") {
    const fetchUrl = pickFetchUrl(row);
    if (fetchUrl.startsWith("http")) {
      try {
        signals = await fetchSiteSignals(fetchUrl);
        if (signals.status === 200) html = signals.html;
      } catch {
        /* hp/recruit from defects only */
      }
      if (html) {
        const origin = originForRow(row);
        recruitPages = await fetchRecruitPages(origin, html);
        for (const p of recruitPages) {
          if (p.html) html += `\n${p.html}`;
        }
      }
    }
  }

  const hp = scoreHpImprove(row, { html, signals });
  const recruit = scoreRecruit({ html, recruitPages });
  const ai = scoreAiOps(row, { html, signals });
  const rec = recommendCampaign({
    track,
    hpScore: hp.score,
    recruitScore: recruit.score,
    aiScore: ai.score,
    hpEvidence: hp.evidence,
    recruitEvidence: recruit.evidence,
    aiEvidence: ai.evidence,
  });

  return {
    url: row.url,
    company: row.company,
    scan_status: row.status,
    track,
    email: row.email || "",
    prefecture: row.prefecture || "",
    final_url: row.final_url || row.url,
    hp_score: String(hp.score),
    recruit_score: String(recruit.score),
    ai_score: String(ai.score),
    recommended_campaign: rec.recommended_campaign,
    campaign_evidence: rec.campaign_evidence,
    enriched_at: new Date().toISOString().slice(0, 19),
  };
}

async function main() {
  if (!fs.existsSync(scanPath)) {
    console.error("FAIL missing scan_results.csv");
    process.exit(1);
  }

  const { rows: scanRows } = parseCsv(fs.readFileSync(scanPath, "utf8"));
  const existing = loadExisting();
  const byUrl = new Map(existing);

  const targets = scanRows.filter((r) => {
    const k = normUrl(r.url);
    if (!k) return false;
    if (!force && existing.has(k)) return false;
    return assignTrack(r) === "inside";
  });

  console.log(`=== enrich-scan-campaign (sleep=${sleepMs}ms) ===`);
  console.log(`scan rows: ${scanRows.length}, to enrich: ${Math.min(targets.length, limit)}\n`);

  let n = 0;
  const stats = { inside: 0, buyout: 0, skip_rec: {} };

  for (const row of targets) {
    if (n >= limit) break;
    process.stdout.write(`enrich ${row.company} … `);
    const result = await enrichRow(row);
    byUrl.set(normUrl(row.url), result);
    stats[result.track] = (stats[result.track] || 0) + 1;
    stats.skip_rec[result.recommended_campaign] =
      (stats.skip_rec[result.recommended_campaign] || 0) + 1;
    console.log(`${result.track} → ${result.recommended_campaign} (hp=${result.hp_score} r=${result.recruit_score} ai=${result.ai_score})`);
    n++;
    if (sleepMs > 0) await sleep(sleepMs);
  }

  // Keep scores for rows not re-enriched
  for (const row of scanRows) {
    const k = normUrl(row.url);
    if (!k || byUrl.has(k)) continue;
    const track = assignTrack(row);
    const hp = scoreHpImprove(row);
    const rec = recommendCampaign({
      track,
      hpScore: hp.score,
      recruitScore: 0,
      aiScore: 0,
      hpEvidence: hp.evidence,
      recruitEvidence: [],
      aiEvidence: [],
    });
    byUrl.set(k, {
      url: row.url,
      company: row.company,
      scan_status: row.status,
      track,
      email: row.email || "",
      prefecture: row.prefecture || "",
      final_url: row.final_url || row.url,
      hp_score: String(hp.score),
      recruit_score: "0",
      ai_score: "0",
      recommended_campaign: rec.recommended_campaign,
      campaign_evidence: rec.campaign_evidence,
      enriched_at: "",
    });
  }

  const allRows = [...byUrl.values()].sort((a, b) => a.company.localeCompare(b.company, "ja"));
  fs.writeFileSync(
    outPath,
    serializeCsv(OUT_HEADERS, allRows, {
      alwaysQuoteHeaders: ["url", "final_url", "email", "campaign_evidence"],
    }) + "\n"
  );

  console.log(`\nRESULT enriched=${n} total_scores=${allRows.length}`);
  console.log("by track this run:", { inside: stats.inside, buyout: stats.buyout });
  console.log("recommended (this run):", stats.skip_rec);
  console.log(`output: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
