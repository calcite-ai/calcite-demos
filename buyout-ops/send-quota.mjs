/**
 * Daily outreach send quota (JST).
 *
 * daily_buyout / daily_inside が空なら daily_sends を buyout に全部割当（後方互換）。
 *
 * Usage:
 *   node buyout-ops/send-quota.mjs
 *   node buyout-ops/send-quota.mjs --json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseCsv } from "./csv-util.mjs";
import { parseOutreachSentDate } from "./outreach-guard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const quotaPath = path.join(__dirname, "send-quota.csv");
const buyoutLeadsPath = path.join(__dirname, "demo_buyout_leads.csv");
const insideLeadsPath = path.join(__dirname, "inside_sales_poc_leads.csv");

export function jstDateString(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** @deprecated alias — use parseOutreachSentDate; kept for callers */
export function parseSentDate(row) {
  return parseOutreachSentDate(row);
}

export function loadQuotaRows() {
  if (!fs.existsSync(quotaPath)) {
    return [{ effective_from: "2026-08-20", daily_sends: "1", daily_buyout: "1", daily_inside: "0", notes: "default" }];
  }
  return parseCsv(fs.readFileSync(quotaPath, "utf8")).rows.filter((r) => r.effective_from);
}

export function dailySendLimit(today = jstDateString()) {
  const rows = loadQuotaRows()
    .map((r) => ({
      from: String(r.effective_from || "").trim(),
      n: Number(r.daily_sends),
      buyout: r.daily_buyout !== "" && r.daily_buyout != null ? Number(r.daily_buyout) : NaN,
      inside: r.daily_inside !== "" && r.daily_inside != null ? Number(r.daily_inside) : NaN,
      notes: r.notes || "",
    }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.from) && Number.isFinite(r.n) && r.n >= 0)
    .filter((r) => r.from <= today)
    .sort((a, b) => a.from.localeCompare(b.from));
  const hit = rows.at(-1);
  if (!hit) {
    return {
      date: today,
      daily_sends: 1,
      daily_buyout: 1,
      daily_inside: 0,
      effective_from: "",
      notes: "fallback 1",
    };
  }
  const daily_buyout = Number.isFinite(hit.buyout) ? hit.buyout : hit.n;
  const daily_inside = Number.isFinite(hit.inside) ? hit.inside : 0;
  return {
    date: today,
    daily_sends: hit.n,
    daily_buyout,
    daily_inside,
    effective_from: hit.from,
    notes: hit.notes,
  };
}

/** Count by send evidence date — status may have been wrongly reset by a pipeline rewrite. */
export function countBuyoutSentOn(today = jstDateString()) {
  if (!fs.existsSync(buyoutLeadsPath)) return 0;
  const { rows } = parseCsv(fs.readFileSync(buyoutLeadsPath, "utf8"));
  return rows.filter((r) => parseOutreachSentDate(r) === today).length;
}

export function countInsideSentOn(today = jstDateString()) {
  if (!fs.existsSync(insideLeadsPath)) return 0;
  const { rows } = parseCsv(fs.readFileSync(insideLeadsPath, "utf8"));
  return rows.filter((r) => parseOutreachSentDate(r) === today).length;
}

/** @deprecated use countBuyoutSentOn */
export function countSentOn(today = jstDateString()) {
  return countBuyoutSentOn(today);
}

export function loadSendQuota(today = jstDateString()) {
  const limit = dailySendLimit(today);
  const buyout_sent_today = countBuyoutSentOn(today);
  const inside_sent_today = countInsideSentOn(today);
  const buyout_remaining = Math.max(0, limit.daily_buyout - buyout_sent_today);
  const inside_remaining = Math.max(0, limit.daily_inside - inside_sent_today);
  const sent_today = buyout_sent_today + inside_sent_today;
  const remaining = buyout_remaining + inside_remaining;
  return {
    ...limit,
    sent_today,
    buyout_sent_today,
    inside_sent_today,
    remaining,
    buyout_remaining,
    inside_remaining,
  };
}

const isMain =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const q = loadSendQuota();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(q, null, 2));
  } else {
    console.log(
      `date=${q.date} daily_sends=${q.daily_sends} buyout=${q.daily_buyout} inside=${q.daily_inside} sent=${q.sent_today} remaining=${q.remaining} (buyout_rem=${q.buyout_remaining} inside_rem=${q.inside_remaining}) from=${q.effective_from}`
    );
  }
}
