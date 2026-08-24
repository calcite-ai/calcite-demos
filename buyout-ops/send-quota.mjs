/**
 * Daily outreach send quota (JST).
 *
 * 通数を途中から変える: send-quota.csv に行を足して push。
 * 当日以降で effective_from が最新の行が効く。
 *
 * Usage:
 *   node buyout-ops/send-quota.mjs
 *   node buyout-ops/send-quota.mjs --json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const quotaPath = path.join(__dirname, "send-quota.csv");
const leadsPath = path.join(__dirname, "demo_buyout_leads.csv");

export function jstDateString(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function parseSentDate(row) {
  const blob = `${row.notes || ""} ${row.owner_approved_at || ""}`;
  const m = blob.match(/初回送信済\s+(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

export function loadQuotaRows() {
  if (!fs.existsSync(quotaPath)) {
    return [{ effective_from: "2026-08-20", daily_sends: "1", notes: "default" }];
  }
  return parseCsv(fs.readFileSync(quotaPath, "utf8")).rows.filter((r) => r.effective_from);
}

export function dailySendLimit(today = jstDateString()) {
  const rows = loadQuotaRows()
    .map((r) => ({
      from: String(r.effective_from || "").trim(),
      n: Number(r.daily_sends),
      notes: r.notes || "",
    }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.from) && Number.isFinite(r.n) && r.n >= 0)
    .filter((r) => r.from <= today)
    .sort((a, b) => a.from.localeCompare(b.from));
  const hit = rows.at(-1);
  return hit ? { date: today, daily_sends: hit.n, effective_from: hit.from, notes: hit.notes } : {
    date: today,
    daily_sends: 1,
    effective_from: "",
    notes: "fallback 1",
  };
}

export function countSentOn(today = jstDateString()) {
  if (!fs.existsSync(leadsPath)) return 0;
  const { rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
  return rows.filter((r) => r.status === "sent" && parseSentDate(r) === today).length;
}

export function loadSendQuota(today = jstDateString()) {
  const limit = dailySendLimit(today);
  const sent_today = countSentOn(today);
  const remaining = Math.max(0, limit.daily_sends - sent_today);
  return { ...limit, sent_today, remaining };
}

const isMain =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const q = loadSendQuota();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(q, null, 2));
  } else {
    console.log(
      `date=${q.date} daily_sends=${q.daily_sends} sent_today=${q.sent_today} remaining=${q.remaining} from=${q.effective_from}`
    );
  }
}
