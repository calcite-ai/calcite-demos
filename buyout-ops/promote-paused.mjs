#!/usr/bin/env node
/**
 * Promote paused leads that already have published demos to queued.
 *
 * Usage:
 *   node buyout-ops/promote-paused.mjs           # dry-run
 *   node buyout-ops/promote-paused.mjs --apply   # update CSV (max 1)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isActiveVertical, rowVertical, verticalLabel } from "./vertical-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apply = process.argv.includes("--apply");

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
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
    rows.push({ line: lines[li], cols, headers });
  }
  return { headers, rows, headerLine: lines[0] };
}

function serializeRow(headers, obj) {
  return headers
    .map((h) => {
      const v = obj[h] ?? "";
      if (v.includes(",") || v.includes('"') || v.includes("\n")) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    })
    .join(",");
}

const EXCLUDE_NOTE = /C0不合格|別公式|別URL|新公式|マキノ型|送らない|do_not_contact/i;

const csvPath = path.join(__dirname, "demo_buyout_leads.csv");
const raw = fs.readFileSync(csvPath, "utf8");
const { headers, rows, headerLine } = parseCsv(raw);

const objects = rows.map(({ cols }) => {
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = cols[i] ?? "";
  });
  return obj;
});

const candidates = objects.filter((r) => {
  if (r.status !== "paused") return false;
  if (!r.demo_url_a || !r.demo_url_b) return false;
  if (String(r.quoted_price || "").trim() !== "66000") return false;
  const notes = `${r.audit_notes || ""} ${r.notes || ""}`;
  if (EXCLUDE_NOTE.test(notes)) return false;
  if (!isActiveVertical(r)) return false;
  return true;
});

if (!candidates.length) {
  console.log(`RESULT none — no paused ${verticalLabel("koumuten")} rows ready to promote`);
  process.exit(0);
}

const pick = candidates[0];
console.log(`candidate: ${pick.company} (${rowVertical(pick)})`);
console.log(`  demo_a: ${pick.demo_url_a}`);
console.log(`  demo_b: ${pick.demo_url_b}`);

if (!apply) {
  console.log("DRY-RUN — use --apply to set status=queued");
  process.exit(0);
}

pick.status = "queued";
if (!pick.notes.includes("promote-paused")) {
  pick.notes = `${pick.notes || ""} / promote-paused ${new Date().toISOString().slice(0, 10)}`.trim();
}

const out = [headerLine, ...objects.map((o) => serializeRow(headers, o))].join("\n") + "\n";
fs.writeFileSync(csvPath, out);
console.log(`RESULT promoted → queued: ${pick.company}`);
process.exit(0);
