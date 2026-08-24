#!/usr/bin/env node
/**
 * Re-scan rows tagged SSL未整備 with Hunter C1 (http + https).
 * HTTPS が通る会社は SSL未整備を外し、粗が2点未満なら CANDIDATE から落とす。
 *
 * Usage: node buyout-ops/prospect-rescan-https.mjs
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

function hasSslDefect(row) {
  return String(row.defects || "").includes("SSL未整備");
}

async function rescanRow(row) {
  const url = row.url || row.final_url;
  if (!url?.startsWith("http")) return row;

  let pack;
  try {
    pack = await fetchSiteWithContacts(url);
  } catch (e) {
    return { ...row, notes: `${row.notes || ""} C1 retry fail: ${e.message}`.trim() };
  }
  if (!pack.signals || pack.signals.status !== 200) {
    return { ...row, notes: `${row.notes || ""} C1 retry HTTP error`.trim() };
  }

  const modern = evaluateModernExclusion(pack.signals);
  if (modern.exclude) {
    return {
      ...row,
      status: "G1_MODERN",
      email: pack.emails[0] || row.email,
      defects: "",
      audit_draft: "",
      final_url: pack.signals.finalUrl,
      notes: `${modern.message} (C1 https rescan)`,
    };
  }

  const email = pack.emails[0] || "";
  if (!email) {
    return {
      ...row,
      status: "NO_EMAIL",
      defects: detectMachineDefects(pack.signals).join("; "),
      audit_draft: "",
      final_url: pack.signals.finalUrl,
      notes: "公開メールなし（C1 https rescan）",
    };
  }

  if (isPriorOutreachBlocked({ company: row.company, email })) {
    return { ...row, status: "BLOCKLIST", email, notes: "blocklist email (C1 rescan)" };
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
      notes: `粗${defects.length}点のみ — C1 https rescan`,
    };
  }

  return {
    ...row,
    status: "CANDIDATE",
    email,
    defects: defects.join("; "),
    audit_draft: auditDraft,
    final_url: pack.signals.finalUrl,
    notes: pack.httpsOk
      ? "朝: C0+C3人手 → verify-hunter-g1 → sales_prospects（C1 https確認）"
      : "朝: C0+C3人手 → verify-hunter-g1 → sales_prospects（C1 https不通）",
  };
}

async function main() {
  const { headers, rows } = parseCsv(fs.readFileSync(outPath, "utf8"));
  let n = 0;
  let sslCleared = 0;
  let droppedCandidate = 0;

  for (let i = 0; i < rows.length; i++) {
    if (!hasSslDefect(rows[i])) continue;
    const prev = rows[i];
    process.stdout.write(`C1 ${prev.company} … `);
    const next = await rescanRow(prev);
    rows[i] = next;
    n++;
    const stillSsl = hasSslDefect(next);
    if (hasSslDefect(prev) && !stillSsl) sslCleared++;
    if (prev.status === "CANDIDATE" && next.status !== "CANDIDATE") droppedCandidate++;
    console.log(
      `${next.status} httpsOk=${!stillSsl && next.status !== "FETCH_FAIL"} defects=${next.defects || "(none)"}`
    );
    if (sleepMs > 0) await new Promise((r) => setTimeout(r, sleepMs));
  }

  fs.writeFileSync(outPath, serializeCsv(headers, rows) + "\n");
  console.log(
    `\nRESULT rescanned=${n} ssl_cleared=${sslCleared} candidate_dropped=${droppedCandidate}`
  );
  console.log(`output: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
