#!/usr/bin/env node
/**
 * 既存リードの宛先実在確認を一括で回し、明確に死んでいる宛先だけ送信プールから外す。
 *
 * 由来: 2026-09-03 の 2通が 2通ともハードバウンス（黒田工務店 / 鐵舟）。
 *       送信前に宛先の実在を見ていなかった。
 *
 * 反映（既存のバウンス運用に合わせる。新しい慣習を作らない）:
 *   buyout → status=paused + bounce_at/bounce_type + notes
 *   inside → status=opt_out + notes + prior_outreach_blocklist.csv に追記
 * dead だけ反映する。unknown は絶対に触らない。
 * sent / opt_out / paused の行は再送ガードの履歴なので読み飛ばす。
 *
 * Usage:
 *   node buyout-ops/audit-recipients.mjs                      # dry-run
 *   node buyout-ops/audit-recipients.mjs --apply
 *   node buyout-ops/audit-recipients.mjs --track inside --limit 20
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";
import { jstDateString } from "./send-quota.mjs";
import { appendPriorOutreachBlocklist } from "./prior-outreach.mjs";
import { isValidPublicEmail } from "./campaign-score.mjs";
import { TERMINAL_LEAD_STATUSES } from "./outreach-guard.mjs";
import { verifyRecipients } from "./verify-recipient.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const apply = process.argv.includes("--apply");
const only = arg("track", "");
const limit = Number(arg("limit", "0"));
const concurrency = Number(arg("concurrency", "8"));
const delayMs = Number(arg("delay-ms", "1200"));
const outJson = arg("out", "");

const tracks = [
  {
    name: "buyout",
    file: path.join(__dirname, "demo_buyout_leads.csv"),
    quote: undefined,
    // 送信待ち = これから送る可能性がある行だけ検査する
    isTarget: (r) => ["approved", "queued", "built"].includes(String(r.status || "").trim()),
    deadStatus: "paused",
  },
  {
    name: "inside",
    file: path.join(__dirname, "inside_sales_poc_leads.csv"),
    quote: ["site_url", "email", "campaign_evidence", "notes"],
    isTarget: (r) => String(r.status || "").trim() === "approved",
    deadStatus: "opt_out",
  },
].filter((t) => !only || t.name === only);

/** serializeCsv は headers に無い列を黙って捨てるので、無い列には書かない */
function setField(track, row, key, value) {
  if (!track.headers.includes(key)) {
    track.skippedFields.add(key);
    return;
  }
  row[key] = value;
}

for (const t of tracks) {
  const parsed = parseCsv(fs.readFileSync(t.file, "utf8"));
  t.headers = parsed.headers;
  t.rows = parsed.rows;
  t.skippedFields = new Set();
  t.touched = false;
  t.targets = t.rows.filter(
    (r) =>
      !TERMINAL_LEAD_STATUSES.has(String(r.status || "").trim()) &&
      t.isTarget(r) &&
      isValidPublicEmail(r.email) &&
      String(r.do_not_contact || "").toLowerCase() !== "true"
  );
  if (limit > 0) t.targets = t.targets.slice(0, limit);
}

const today = jstDateString();
const report = { dry_run: !apply, date: today, tracks: [] };

for (const t of tracks) {
  const emails = t.targets.map((r) => String(r.email).trim());
  const byEmail = new Map();
  for (const r of t.targets) byEmail.set(String(r.email).trim().toLowerCase(), r);

  process.stderr.write(`\n[${t.name}] probing ${emails.length} recipients...\n`);
  const results = await verifyRecipients(emails, {
    concurrency,
    delayMs,
    force: true,
    onResult: (r, i, n) => {
      if (r.state !== "unknown") {
        process.stderr.write(`  ${i}/${n} ${r.state.toUpperCase()} ${r.email} (${r.reason})\n`);
      } else if (i % 25 === 0) {
        process.stderr.write(`  ${i}/${n} ...\n`);
      }
    },
  });

  const counts = { ok: 0, dead: 0, unknown: 0, skipped: 0 };
  const dead = [];
  for (const r of results) {
    counts[r.state] = (counts[r.state] || 0) + 1;
    if (r.state !== "dead") continue;
    const row = byEmail.get(r.email.toLowerCase());
    if (!row) continue;
    dead.push({ company: row.company, email: r.email, reason: r.reason, detail: r.detail });
    setField(t, row, "status", t.deadStatus);
    setField(t, row, "bounce_at", today);
    setField(t, row, "bounce_type", "hard");
    // buyout の paused は promote-paused.mjs が queued に戻せる。
    // 「送らない」は既存の EXCLUDE_NOTE、do_not_contact は queue-status の除外条件。
    setField(t, row, "do_not_contact", "true");
    setField(
      t,
      row,
      "notes",
      `${row.notes || ""} / 宛先不在 ${today} verify-recipient ${r.reason} (${(r.detail || "").slice(0, 60)}) 二度と送らない`.trim()
    );
    t.touched = true;
    if (t.name === "inside" && apply) {
      appendPriorOutreachBlocklist({
        company: row.company,
        email: r.email,
        // 実際には送っていない。送信実績ではなく「宛先が無いので永久に送らない」印
        sent_via: "verify-recipient(未送信)",
        sent_date: today,
        notes: `宛先不在 verify-recipient ${r.reason}`,
      });
    }
  }

  report.tracks.push({
    track: t.name,
    probed: results.length,
    counts,
    dead,
    ok: results.filter((r) => r.state === "ok").map((r) => r.email),
    skipped_fields: [...t.skippedFields],
  });

  if (apply && t.touched) {
    fs.writeFileSync(
      t.file,
      serializeCsv(t.headers, t.rows, t.quote ? { alwaysQuoteHeaders: t.quote } : {}) + "\n"
    );
  }
}

if (outJson) fs.writeFileSync(outJson, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
for (const t of report.tracks) {
  console.log(
    `RESULT ${t.track} — probed=${t.probed} ok=${t.counts.ok} dead=${t.counts.dead} unknown=${t.counts.unknown}${
      apply ? " (applied)" : " (dry-run)"
    }`
  );
}
