#!/usr/bin/env node
/**
 * 朝レビュー用シートを scan_results の CANDIDATE から生成。
 * 既存 review_queue の owner_ok / owner_notes は URL 単位で維持。
 * scan_results に無い CANDIDATE は除外（DOMAIN_HIJACK 等）。
 *
 * Usage: node buyout-ops/prepare-review-sheet.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";
import { isValidPublicEmail } from "./campaign-score.mjs";

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

function rowKey(r) {
  return String(r.url || "").trim().toLowerCase();
}

if (!fs.existsSync(scanPath)) {
  console.log("RESULT none — run prospect-scan-batch.mjs first");
  process.exit(0);
}

const { rows: scanRows } = parseCsv(fs.readFileSync(scanPath, "utf8"));
const allCandidates = scanRows.filter((r) => r.status === "CANDIDATE");
// フォーム記入例メール（yourmail@sample.co.jp 等）はレビューに載せない — 誤送信になる
const candidates = allCandidates.filter((r) => isValidPublicEmail(r.email));
for (const r of allCandidates) {
  if (!isValidPublicEmail(r.email)) {
    console.log(`SKIP invalid email: ${r.company} <${r.email || "(empty)"}>`);
  }
}

let ownerByUrl = new Map();
if (fs.existsSync(outPath)) {
  for (const r of parseCsv(fs.readFileSync(outPath, "utf8")).rows) {
    const k = rowKey(r);
    if (!k) continue;
    ownerByUrl.set(k, { owner_ok: r.owner_ok || "", owner_notes: r.owner_notes || "" });
  }
}

const merged = candidates.map((r) => {
  const k = rowKey(r);
  const owner = ownerByUrl.get(k) || { owner_ok: "", owner_notes: "" };
  return {
    approval_seq: "",
    company: r.company,
    url: r.url,
    email: r.email,
    defects: r.defects,
    audit_draft: r.audit_draft,
    final_url: r.final_url,
    owner_ok: owner.owner_ok,
    owner_notes: owner.owner_notes,
  };
});

merged.forEach((r, i) => {
  r.approval_seq = String(i + 1);
});

if (!merged.length) {
  console.log("RESULT none — no CANDIDATE in scan_results");
  process.exit(0);
}

fs.writeFileSync(
  outPath,
  serializeCsv(HEADERS, merged, { alwaysQuoteHeaders: ["url", "final_url", "email"] }) + "\n"
);
console.log(`RESULT ${merged.length} rows → ${outPath}`);
console.log("Owner: owner_ok=y の行だけ import-review-approvals.mjs で承認キューへ");
