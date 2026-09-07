#!/usr/bin/env node
/**
 * 毎朝の点検。実行の失敗ではなく「誰も気づかない状態」を拾う。
 *
 * 既存ゲート（verify-ops-pack / verify-before-send）は送信を止める。
 * こちらは止めない。異常を並べて人に渡すだけ。
 *
 * Usage:
 *   node buyout-ops/ops-healthcheck.mjs
 *   node buyout-ops/ops-healthcheck.mjs --days 7
 *
 * Exit 0 = 異常なし / 1 = 要確認あり
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-util.mjs";
import { dailySendLimit, jstDateString } from "./send-quota.mjs";
import { loadReceipts } from "./send-receipts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const daysIdx = process.argv.indexOf("--days");
const DAYS = daysIdx >= 0 ? Number(process.argv[daysIdx + 1]) || 7 : 7;
const SENDGRID_TRIAL_END = "2026-10-29";

const findings = [];
const notes = [];
const flag = (sev, area, msg) => findings.push({ sev, area, msg });

function jstDaysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return jstDateString(d);
}
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

/* 1. 日ごとの送信数 vs その日の枠 ------------------------------------ */
const receipts = loadReceipts();
const byDay = new Map();
for (const r of receipts) {
  const day = String(r.jst || r.at || "").slice(0, 10);
  if (!day) continue;
  const track = r.track === "inside" ? "inside" : "buyout";
  const k = `${day}|${track}`;
  byDay.set(k, (byDay.get(k) || 0) + 1);
}
for (let i = 0; i <= DAYS; i++) {
  const day = jstDaysAgo(i);
  const limit = dailySendLimit(day);
  for (const [track, cap] of [
    ["buyout", limit.daily_buyout],
    ["inside", limit.daily_inside],
  ]) {
    const n = byDay.get(`${day}|${track}`) || 0;
    if (n > cap) {
      flag("HIGH", "送信枠", `${day} ${track} が枠超過: ${n}通 / 上限${cap}通`);
    }
  }
}

/* 2. 同一宛先への重複送信 -------------------------------------------- */
const seen = new Map();
for (const r of receipts) {
  const day = String(r.jst || r.at || "").slice(0, 10);
  const key = `${day}|${String(r.email || "").toLowerCase()}`;
  if (!r.email) continue;
  seen.set(key, (seen.get(key) || 0) + 1);
}
for (const [key, n] of seen) {
  if (n < 2) continue;
  const [day, email] = key.split("|");
  if (daysBetween(day, jstDateString()) > DAYS) continue;
  flag("HIGH", "重複送信", `${day} ${email} に${n}件のレシート`);
}

/* 3. queued / built の滞留 ------------------------------------------- */
const leadsPath = path.join(__dirname, "demo_buyout_leads.csv");
const { rows: leads } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
const stuck = leads.filter((r) => r.status === "queued" || r.status === "built");
const today = jstDateString();
for (const r of stuck) {
  // queued は当日中に送られる前提。前日以前のものは詰まっている
  const q = r.owner_approved_at || "";
  if (q && daysBetween(q, today) > 2) {
    flag("MID", "滞留", `${r.company} が ${r.status} のまま（承認 ${q}）`);
  }
}
notes.push(`queued/built=${stuck.length}`);

/* 4. 在庫と枯渇予測 --------------------------------------------------- */
const approved = leads.filter(
  (r) => r.status === "approved" && String(r.do_not_contact).toLowerCase() !== "true"
);
const cap = dailySendLimit(today).daily_buyout || 0;
const runway = cap > 0 ? Math.floor(approved.length / cap) : Infinity;
notes.push(`approved_waiting=${approved.length} → 残り約${runway}日分（${cap}通/日）`);
if (runway <= 7) {
  flag("MID", "在庫", `承認済み在庫が残り約${runway}日分。承認を進めないと止まる`);
}

const rqPath = path.join(__dirname, "prospect_pipeline", "review_queue.csv");
if (fs.existsSync(rqPath)) {
  const { rows: rq } = parseCsv(fs.readFileSync(rqPath, "utf8"));
  const pending = rq.filter((r) => !String(r.owner_ok || "").trim()).length;
  notes.push(`review_queue 未承認=${pending}`);
  if (pending > 0 && runway <= 14) {
    flag("MID", "在庫", `review_queue に${pending}件が承認待ち。在庫${runway}日分と併せて要判断`);
  }
}

/* 5. MCP / 認証の期限 ------------------------------------------------- */
const gmailCred = path.join(os.homedir(), ".gmail-mcp", "credentials.json");
if (fs.existsSync(gmailCred)) {
  const age = Math.floor((Date.now() - fs.statSync(gmailCred).mtimeMs) / 86400000);
  notes.push(`gmail credentials: ${age}日前に更新`);
  // refresh_token 失効は叩くまで分からない。長期未更新を警告として出す
  if (age > 30) {
    flag("MID", "認証", `gmail credentials が${age}日間未更新。invalid_grant の可能性（2026-08-16〜09-06 に3週間失効した前例あり）`);
  }
}

/* 6. SendGrid trial ---------------------------------------------------- */
const left = daysBetween(today, SENDGRID_TRIAL_END);
notes.push(`SendGrid trial 残り${left}日（${SENDGRID_TRIAL_END}）`);
if (left <= 21) {
  flag(left <= 7 ? "HIGH" : "MID", "SendGrid",
    `trial 終了まで${left}日。Essentials への切替判断が必要（SENDGRID_UPGRADE_RUNBOOK.md）`);
}

/* 6b. 前日の送信が枠を使い切ったか ----------------------------------- */
{
  const y = jstDaysAgo(1);
  const cap = dailySendLimit(y).daily_buyout;
  const n = byDay.get(`${y}|buyout`) || 0;
  notes.push(`前日(${y}) buyout 送信 ${n}/${cap}`);
  if (cap > 0 && n === 0) {
    flag("HIGH", "送信", `${y} の送信が 0 通。cron 不発かゲート FAIL の可能性（2026-09-07 に発生）`);
  } else if (n < cap) {
    flag("MID", "送信", `${y} は ${n}/${cap} 通どまり。在庫切れなら正常、そうでなければ要確認`);
  }
}

/* 7. 直近の Actions failure ------------------------------------------- */
try {
  const out = execFileSync(
    "gh",
    ["run", "list", "--limit", "25", "--json", "name,conclusion,createdAt,databaseId"],
    { cwd: path.resolve(__dirname, ".."), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  const runs = JSON.parse(out).filter(
    (r) => r.conclusion === "failure" && daysBetween(r.createdAt.slice(0, 10), today) <= DAYS
  );
  for (const r of runs) {
    flag("MID", "Actions", `${r.createdAt.slice(0, 16)} ${r.name} が failure (id=${r.databaseId})`);
  }
  notes.push(`Actions 直近25件中の failure=${runs.length}`);
} catch {
  notes.push("Actions: gh 未認証か未インストールのため未確認");
}

/* 出力 ----------------------------------------------------------------- */
console.log(`=== ops-healthcheck ${today} (直近${DAYS}日) ===\n`);
for (const n of notes) console.log(`  ${n}`);
console.log("");
if (!findings.length) {
  console.log("RESULT OK — 異常なし");
  process.exit(0);
}
const order = { HIGH: 0, MID: 1 };
findings.sort((a, b) => order[a.sev] - order[b.sev]);
for (const f of findings) console.log(`  [${f.sev}] ${f.area}: ${f.msg}`);
console.log(`\nRESULT ${findings.length} 件の要確認`);
process.exit(1);
