#!/usr/bin/env node
/**
 * Re-scan scan_results rows with status=FETCH_FAIL (often index.html URL bug).
 * Usage: node buyout-ops/prospect-rescan-fetch-fail.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";
import {
  evaluateModernExclusion,
  detectMachineDefects,
  formatRoughAudit,
  fetchSiteWithContacts,
} from "./site-g1-eval.mjs";
import { isPriorOutreachBlocked } from "./prior-outreach.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "prospect_pipeline", "scan_results.csv");
const sleepMs = Number(process.argv.find((a, i) => process.argv[i - 1] === "--sleep-ms") || "1500");
const limit = Number(process.argv.find((a, i) => process.argv[i - 1] === "--limit") || "0") || Infinity;

async function rescanRow(row) {
  const url = row.url;
  let pack;
  try {
    pack = await fetchSiteWithContacts(url);
  } catch (e) {
    return { ...row, notes: e.message };
  }
  if (!pack.signals || pack.signals.status !== 200) {
    return { ...row, notes: "HTTP error (retry)" };
  }

  const modern = evaluateModernExclusion(pack.signals);
  if (modern.exclude) {
    return {
      ...row,
      status: "G1_MODERN",
      email: pack.emails[0] || "",
      final_url: pack.signals.finalUrl,
      notes: modern.message,
    };
  }

  const email = pack.emails[0] || "";
  if (!email) {
    return {
      ...row,
      status: "NO_EMAIL",
      final_url: pack.signals.finalUrl,
      notes: "公開メールなし（フォームのみ）",
    };
  }

  if (isPriorOutreachBlocked({ company: row.company, email })) {
    return { ...row, status: "BLOCKLIST", email, notes: "blocklist email" };
  }

  const defects = detectMachineDefects(pack.signals);
  const auditDraft = formatRoughAudit(defects);
  if (defects.length < 2) {
    return {
      ...row,
      status: "G1_WEAK",
      email,
      defects: defects.join("; "),
      audit_draft: auditDraft,
      final_url: pack.signals.finalUrl,
      notes: `粗${defects.length}点のみ`,
    };
  }

  return {
    ...row,
    status: "CANDIDATE",
    email,
    defects: defects.join("; "),
    audit_draft: auditDraft,
    final_url: pack.signals.finalUrl,
    notes: "fetch-fail retry → CANDIDATE",
  };
}

async function main() {
  const { headers, rows } = parseCsv(fs.readFileSync(outPath, "utf8"));
  let updated = 0;
  let newCandidates = 0;
  let tried = 0;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i].status !== "FETCH_FAIL") continue;
    if (tried >= limit) break;
    tried++;
    process.stdout.write(`retry ${rows[i].company} … `);
    const next = await rescanRow(rows[i]);
    rows[i] = next;
    if (next.status !== "FETCH_FAIL") updated++;
    if (next.status === "CANDIDATE") newCandidates++;
    console.log(next.status + (next.email ? ` ${next.email}` : ""));
    if (sleepMs > 0) await new Promise((r) => setTimeout(r, sleepMs));
  }

  fs.writeFileSync(outPath, serializeCsv(headers, rows) + "\n");
  console.log(`\nRESULT tried=${tried} fixed=${updated} new_candidates=${newCandidates}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
