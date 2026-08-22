#!/usr/bin/env node
/**
 * Report send-queue depth for daily automation.
 * Exit 0 = has sendable targets. Exit 2 = empty (run hunter refill).
 *
 * Usage:
 *   node buyout-ops/queue-status.mjs
 *   node buyout-ops/queue-status.mjs --json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTIVE_VERTICAL, isActiveVertical, verticalLabel } from "./vertical-config.mjs";
import { isPriorOutreachBlocked } from "./prior-outreach.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

const csvPath = path.join(__dirname, "demo_buyout_leads.csv");
const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));

const queued = rows.filter(
  (r) =>
    (r.status === "queued" || r.status === "built") &&
    String(r.do_not_contact).toLowerCase() !== "true" &&
    !isPriorOutreachBlocked({ company: r.company, email: r.email }) &&
    r.demo_url_a &&
    r.demo_url_b &&
    isActiveVertical(r)
);

const result = {
  queued: rows.filter((r) => r.status === "queued").length,
  built: rows.filter((r) => r.status === "built").length,
  sendable: queued.length,
  next: queued[0]
    ? { company: queued[0].company, email: queued[0].email, status: queued[0].status }
    : null,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`queued=${result.queued} built=${result.built} sendable=${result.sendable} vertical=${ACTIVE_VERTICAL}(${verticalLabel(ACTIVE_VERTICAL)})`);
  if (result.next) {
    console.log(`next: ${result.next.company} (${result.next.status})`);
  }
}

process.exit(result.sendable > 0 ? 0 : 2);
