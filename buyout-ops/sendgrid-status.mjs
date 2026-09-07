#!/usr/bin/env node
/**
 * SendGrid の現況をまとめて出す（読み取りのみ・メールは送らない）。
 *
 *   node buyout-ops/sendgrid-status.mjs [--days 30] [--json]
 *
 * 見るもの:
 *   アカウント種別 / 評価スコア / 当日クレジット
 *   配信統計（送信・配信・開封・クリック・バウンス・迷惑報告）
 *   トラッキング設定（開封/クリックが有効でなければ統計は 0 のままになる）
 *   サプレッション（バウンス・ブロック・無効宛先・迷惑報告・配信停止）
 *
 * 必要: SENDGRID_API_KEY
 */
import { sendgridSmtpHeaders } from "./sendgrid-smtp-headers.mjs";

const KEY = process.env.SENDGRID_API_KEY;
if (!KEY) {
  console.error("FAIL SENDGRID_API_KEY が無い");
  process.exit(1);
}
const days = Number((process.argv.find((a) => a.startsWith("--days=")) || "").split("=")[1]) ||
  Number(process.argv[process.argv.indexOf("--days") + 1]) || 30;
const asJson = process.argv.includes("--json");

async function get(path) {
  const res = await fetch(`https://api.sendgrid.com/v3${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) return { __error: `${res.status} ${res.statusText}`, __path: path };
  return res.json();
}

const jst = (d) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(d);
const today = jst(new Date());
const start = jst(new Date(Date.now() - days * 86400000));

const [account, credits, stats, tracking, bounces, blocks, invalid, spam, unsub] =
  await Promise.all([
    get("/user/account"),
    get("/user/credits"),
    get(`/stats?start_date=${start}&end_date=${today}&aggregated_by=day`),
    get("/tracking_settings"),
    get("/suppression/bounces"),
    get("/suppression/blocks"),
    get("/suppression/invalid_emails"),
    get("/suppression/spam_reports"),
    get("/asm/suppressions/global"),
  ]);

// stats は [{date, stats:[{metrics:{...}}]}] の形。合計と、動きのあった日だけ拾う。
const M = ["requests", "delivered", "opens", "unique_opens", "clicks", "unique_clicks",
  "bounces", "spam_reports", "unsubscribes", "blocks", "invalid_emails"];
const total = Object.fromEntries(M.map((k) => [k, 0]));
const active = [];
for (const d of Array.isArray(stats) ? stats : []) {
  const m = d.stats?.[0]?.metrics || {};
  for (const k of M) total[k] += Number(m[k] || 0);
  if (Number(m.requests || 0) > 0) active.push({ date: d.date, ...Object.fromEntries(M.map((k) => [k, Number(m[k] || 0)])) });
}

// クリックの出所を切り分けるための材料。free プランでは取れないものもある。
const [devices, clients, geo, webhook, messages] = await Promise.all([
  get(`/devices/stats?start_date=${start}&end_date=${today}`),
  get(`/clients/stats?start_date=${start}&end_date=${today}`),
  get(`/geo/stats?start_date=${start}&end_date=${today}`),
  get("/user/webhooks/event/settings"),
  get(`/messages?limit=20`),
]);
const flatten = (arr) => {
  const acc = {};
  for (const d of Array.isArray(arr) ? arr : []) {
    for (const st of d.stats || []) {
      const n = st.name || st.type || "?";
      acc[n] = acc[n] || {};
      for (const [k, v] of Object.entries(st.metrics || {})) acc[n][k] = (acc[n][k] || 0) + Number(v || 0);
    }
  }
  return acc;
};
const byDevice = flatten(devices), byClient = flatten(clients), byGeo = flatten(geo);

const supp = {
  bounces: Array.isArray(bounces) ? bounces.length : `?(${bounces.__error})`,
  blocks: Array.isArray(blocks) ? blocks.length : `?(${blocks.__error})`,
  invalid_emails: Array.isArray(invalid) ? invalid.length : `?(${invalid.__error})`,
  spam_reports: Array.isArray(spam) ? spam.length : `?(${spam.__error})`,
  global_unsubscribes: Array.isArray(unsub) ? unsub.length : `?(${unsub.__error})`,
};

const trk = {
  open: tracking?.result?.find?.((t) => t.name === "open")?.enabled ?? null,
  click: tracking?.result?.find?.((t) => t.name === "click")?.enabled ?? null,
  subscription: tracking?.result?.find?.((t) => t.name === "subscription")?.enabled ?? null,
};

if (asJson) {
  console.log(JSON.stringify(
    { today_jst: today, window: { start, end: today, days },
      account: { type: account?.type, reputation: account?.reputation },
      credits, tracking: trk, total, active_days: active, suppression: supp },
    null, 2));
  process.exit(0);
}

const pct = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—");
console.log(`SendGrid 現況  ${today} JST（直近${days}日: ${start} 〜 ${today}）\n`);
console.log(`アカウント : ${account?.type ?? "?"} / 評価スコア ${account?.reputation ?? "?"}`);
console.log(`クレジット : ${credits?.remain ?? "?"} / ${credits?.total ?? "?"}（${credits?.reset_frequency ?? "?"}・次リセット ${credits?.next_reset ?? "?"}）`);
// アカウント設定より、送信時の X-SMTPAPI ヘッダの方が強い。実効値はこちら。
let eff = null;
try {
  const h = sendgridSmtpHeaders.call(null);
  const raw = h["X-SMTPAPI"] ||
    (() => { process.env.BUYOUT_MAIL_PROVIDER = "sendgrid"; return sendgridSmtpHeaders()["X-SMTPAPI"]; })();
  const f = JSON.parse(raw).filters || {};
  eff = { open: f.opentrack?.settings?.enable === 1, click: f.clicktrack?.settings?.enable === 1 };
} catch { /* ヘッダを読めないときはアカウント設定だけ出す */ }
console.log(`トラッキング(アカウント設定): 開封=${trk.open} クリック=${trk.click} 配信停止リンク=${trk.subscription}`);
if (eff) {
  console.log(`トラッキング(実際の送信ヘッダ): 開封=${eff.open} クリック=${eff.click}  ← こちらが優先される`);
  if (!eff.open) console.log(`  ※ 開封は送信側で切ってある。下の開封数 0 は「誰も開いていない」ではなく「測っていない」。`);
}
console.log(`\n配信統計（合計）`);
console.log(`  送信要求   ${total.requests}`);
console.log(`  配信完了   ${total.delivered}  (${pct(total.delivered, total.requests)})`);
console.log(`  開封       ${total.unique_opens} 人 / のべ ${total.opens}  (開封率 ${pct(total.unique_opens, total.delivered)})`);
console.log(`  クリック   ${total.unique_clicks} 人 / のべ ${total.clicks}  (クリック率 ${pct(total.unique_clicks, total.delivered)})`);
console.log(`  バウンス   ${total.bounces}   ブロック ${total.blocks}   無効宛先 ${total.invalid_emails}`);
console.log(`  迷惑報告   ${total.spam_reports}   配信停止 ${total.unsubscribes}`);
if (active.length) {
  console.log(`\n送信のあった日`);
  for (const a of active) {
    console.log(`  ${a.date}  要求${a.requests} 配信${a.delivered} 開封${a.unique_opens} クリック${a.unique_clicks} バウンス${a.bounces} 迷惑${a.spam_reports}`);
  }
}
console.log(`\nサプレッション（累計・宛先数）`);
for (const [k, v] of Object.entries(supp)) console.log(`  ${k.padEnd(20)} ${v}`);
console.log(`\nクリック/開封の出所`);
const dump = (label, obj, err) => {
  const keys = Object.keys(obj);
  if (!keys.length) { console.log(`  ${label}: 取得不可/データなし${err ? ` (${err})` : ""}`); return; }
  for (const k of keys) console.log(`  ${label} ${k}: ${JSON.stringify(obj[k])}`);
};
dump("デバイス", byDevice, devices?.__error);
dump("クライアント", byClient, clients?.__error);
dump("国", byGeo, geo?.__error);
console.log(`  イベントWebhook: ${webhook?.__error ? `取得不可 (${webhook.__error})` : `enabled=${webhook?.enabled} url=${webhook?.url || "(未設定)"} click=${webhook?.click} open=${webhook?.open}`}`);
console.log(`  Email Activity API: ${messages?.__error ? `使えない (${messages.__error})` : `使える（${(messages?.messages || []).length}件取得）`}`);
if (Array.isArray(messages?.messages)) {
  const per = {};
  for (const m of messages.messages) {
    const e = m.to_email || "?";
    per[e] = per[e] || { msgs: 0, clicks: 0 };
    per[e].msgs++; per[e].clicks += Number(m.clicks_count || 0);
  }
  const bcc = "kenta.hino1106@gmail.com";
  const own = Object.entries(per).filter(([e]) => e === bcc);
  const pros = Object.entries(per).filter(([e]) => e !== bcc);
  console.log(`  --- 宛先別（Activity で見えている範囲のみ） ---`);
  for (const [e, v] of own) console.log(`    [自分のBCC] ${e}: ${v.msgs}通 クリック${v.clicks}`);
  const pc = pros.reduce((a, [, v]) => a + v.clicks, 0);
  console.log(`    [営業先] ${pros.length}宛先 ${pros.reduce((a,[,v])=>a+v.msgs,0)}通 クリック合計 ${pc}`);
  for (const [e, v] of pros) console.log(`      ${e}: クリック${v.clicks}`);
}
if (Array.isArray(messages?.messages)) {
  for (const m of messages.messages.slice(0, 20)) {
    console.log(`    ${m.last_event_time} ${m.status} ${m.to_email} clicks=${m.clicks_count ?? "?"} opens=${m.opens_count ?? "?"}`);
  }
}

