#!/usr/bin/env node
/**
 * Ensure funnel metrics columns exist on demo_buyout_leads.csv and backfill sent_at.
 *
 * Safe / idempotent. Does not invent reply/order data.
 *
 * Usage: node buyout-ops/migrate-metrics-columns.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";
import { parseSentDate } from "./send-quota.mjs";
import { METRICS_COLUMNS } from "./metrics-columns.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const leadsPath = path.join(__dirname, "demo_buyout_leads.csv");

export function migrateMetricsColumns() {
  const { headers, rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
  const nextHeaders = [...headers];
  for (const col of METRICS_COLUMNS) {
    if (!nextHeaders.includes(col)) nextHeaders.push(col);
  }

  let filled = 0;
  for (const row of rows) {
    for (const col of METRICS_COLUMNS) {
      if (row[col] == null) row[col] = "";
    }
    if (!row.sent_at) {
      const d = parseSentDate(row);
      if (d) {
        row.sent_at = d;
        filled += 1;
      }
    }
    if (!row.template_version && (row.sent_at || row.status === "sent")) {
      row.template_version =
        String(row.quoted_price) === "55000" ? "v1_initial_55k" : "v1_initial_66k";
    }
    if (!row.bounce_at && /bounce|mailbox full|Quota exceeded|552/i.test(row.notes || "")) {
      const m = String(row.notes || "").match(/(\d{4}-\d{2}-\d{2})/);
      if (m) row.bounce_at = m[1];
      if (!row.bounce_type) {
        row.bounce_type = /mailbox full|Quota exceeded|5\.2\.2/i.test(row.notes || "")
          ? "mailbox_full"
          : "soft";
      }
    }
  }

  fs.writeFileSync(leadsPath, serializeCsv(nextHeaders, rows) + "\n");
  return { headers: nextHeaders.length, sent_at_backfill: filled };
}

const isMain =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const r = migrateMetricsColumns();
  console.log(
    `RESULT ok — metrics columns ready. headers=${r.headers} sent_at_backfill=${r.sent_at_backfill}`
  );
}
