#!/usr/bin/env node
/**
 * 朝レビュー用シートを scan_results の CANDIDATE から生成。
 * オーナーが owner_ok 列に y を付けて import-review-approvals.mjs へ。
 *
 * Usage: node buyout-ops/prepare-review-sheet.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scanPath = path.join(__dirname, "prospect_pipeline", "scan_results.csv");
const outPath = path.join(__dirname, "prospect_pipeline", "review_queue.csv");

const HEADERS = [
  "approval_seq",
  "company",
  "url",
  "email",
  "defects",
  "audit_draft",
  "final_url",
  "owner_ok",
  "owner_notes",
];

if (!fs.existsSync(scanPath)) {
  console.log("RESULT none — run prospect-scan-batch.mjs first");
  process.exit(0);
}

const { rows } = parseCsv(fs.readFileSync(scanPath, "utf8"));
const candidates = rows.filter((r) => r.status === "CANDIDATE");

if (!candidates.length) {
  console.log("RESULT none — no CANDIDATE in scan_results (種URLを増やして再スキャン)");
  process.exit(0);
}

const outRows = candidates.map((r, i) => ({
  approval_seq: String(i + 1),
  company: r.company,
  url: r.url,
  email: r.email,
  defects: r.defects,
  audit_draft: r.audit_draft,
  final_url: r.final_url,
  owner_ok: "",
  owner_notes: "",
}));

fs.writeFileSync(outPath, serializeCsv(HEADERS, outRows) + "\n");
console.log(`RESULT ${outRows.length} rows → ${outPath}`);
console.log("Owner: owner_ok=y の行だけ import-review-approvals.mjs で承認キューへ");
