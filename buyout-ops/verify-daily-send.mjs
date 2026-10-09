#!/usr/bin/env node
/**
 * 当日の送信が成立したかを、送信ウィンドウが閉じたあとに検証する。
 *
 * 2026-09-07: 本文ゲートの取り残し（works/ 未対応）と cron の不発が重なり、
 * 当日の送信が 0 通で終わった。8:30 の点検は送信より前に走るため拾えず、
 * オーナーが夕方に気づくまで誰も知らなかった。
 *
 * 「送るべきものがあったのに送れていない」= 異常として検出する。
 *
 * Usage: node buyout-ops/verify-daily-send.mjs
 * Exit 0 = 正常 / 1 = 未送信あり
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jstDateString, loadSendQuota } from "./send-quota.mjs";
import { loadReceipts } from "./send-receipts.mjs";
import { outsideSendWindow } from "./send-window.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// GitHub Actions の cron は数時間遅れて発火する（18:00 JST 狙いが翌 01:00 JST など）。
// 日付が変わった後に走った場合は、窓が閉じたばかりの「前日」を検証する。
// 新しい日の 0 通を異常と誤認し、毎日 Issue が立っていた（2026-09-30〜10-10）。
const jstHour = Number(
  new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", hour12: false }).format(new Date())
) % 24;
const today = jstHour < 9 ? jstDateString(new Date(Date.now() - 24 * 3600 * 1000)) : jstDateString();
const q = loadSendQuota(today);

function queueStatus() {
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, "queue-status.mjs"), "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return JSON.parse(out || "{}");
  } catch (e) {
    // queue-status は対象なしで非0を返すので stdout を拾う
    try {
      return JSON.parse(e.stdout || "{}");
    } catch {
      return {};
    }
  }
}

const st = queueStatus();
const sendable = Number(st.sendable ?? 0);
const sentToday = q.buyout_sent_today;
const remaining = q.buyout_remaining;
const off = jstHour < 9 ? { hour: jstHour, from: 9, to: 18 } : outsideSendWindow();

console.log(`=== daily-send 検証 ${today} ===\n`);
console.log(`  送信済み  ${sentToday} / 枠 ${q.daily_buyout}`);
console.log(`  残枠      ${remaining}`);
console.log(`  sendable  ${sendable}`);
console.log(`  時刻      ${off ? `${off.hour}時（送信可 ${off.from}-${off.to}時 の外）` : "送信可能時間内"}`);
console.log("");

const problems = [];

// 送るものがあり、枠も残っていて、ウィンドウが閉じた後なのに送れていない
if (off && remaining > 0 && sendable > 0) {
  problems.push(
    `本日 ${sendable} 社が送信可能で残枠 ${remaining} だったが、送信ウィンドウ内に送られなかった`
  );
}
// 枠を使い切れていない（在庫はあった）。ただし daily_buyout=0 は
// オーナーが意図的に送信を止めている日（send-quota.csv参照）なので異常ではない
// （2026-09-12 電話フォロー切り替えで発生、誤ってwatchdogがIssueを立てた）
if (off && q.daily_buyout > 0 && sentToday === 0 && sendable > 0) {
  problems.push("本日の送信が 0 通。cron 不発かゲート FAIL の可能性 — Actions のログを確認");
}

if (!problems.length) {
  console.log("RESULT OK — 送信は成立、または送るものがなかった");
  process.exit(0);
}
for (const p of problems) console.log(`  [HIGH] ${p}`);
console.log(`\nRESULT ${problems.length} 件の要確認`);
process.exit(1);
