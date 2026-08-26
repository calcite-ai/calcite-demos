#!/usr/bin/env node
/**
 * Company-level buyout funnel report (no open-rate).
 *
 * Usage:
 *   node buyout-ops/metrics-report.mjs
 *   node buyout-ops/metrics-report.mjs --json
 *   node buyout-ops/metrics-report.mjs --write   # → buyout-ops/metrics/funnel-latest.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-util.mjs";
import { parseSentDate, jstDateString } from "./send-quota.mjs";
import { METRICS_COLUMNS } from "./metrics-columns.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const leadsPath = path.join(__dirname, "demo_buyout_leads.csv");
const outDir = path.join(__dirname, "metrics");
const outFile = path.join(outDir, "funnel-latest.md");

const { rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
for (const row of rows) {
  for (const col of METRICS_COLUMNS) {
    if (row[col] == null) row[col] = "";
  }
  if (!row.sent_at) row.sent_at = parseSentDate(row);
}

function isSent(r) {
  return r.status === "sent" || Boolean(r.sent_at);
}
function isBounce(r) {
  return Boolean(r.bounce_at) || /bounce|mailbox full|Quota exceeded/i.test(r.notes || "");
}
function isReply(r) {
  return (
    Boolean(r.reply_at || r.reply_type) ||
    ["a_hope", "b_hope", "buy", "question", "custom", "decline", "opt_out", "other"].includes(
      r.reply_class
    )
  );
}
function isOrder(r) {
  return Boolean(r.order_at) || (Number(r.order_amount_yen) > 0);
}

const sent = rows.filter(isSent);
const bounced = rows.filter(isBounce);
const deliveredApprox = sent.length; // successful SMTP accept; bounce may be after
const replies = rows.filter(isReply);
const aHope = rows.filter((r) => r.reply_type === "a_hope" || r.reply_class === "a_hope");
const bHope = rows.filter((r) => r.reply_type === "b_hope" || r.reply_class === "b_hope");
const optOut = rows.filter(
  (r) =>
    r.reply_type === "opt_out" ||
    (String(r.do_not_contact).toLowerCase() === "true" &&
      /opt_out|配信停止/.test(r.notes || ""))
);
const meetings = rows.filter((r) => r.meeting_at);
const quotes = rows.filter((r) => r.quote_at);
const orders = rows.filter(isOrder);
const revenue = orders.reduce((s, r) => s + (Number(r.order_amount_yen) || 0), 0);

const byTemplate = {};
for (const r of sent) {
  const t = r.template_version || (String(r.quoted_price) === "55000" ? "v1_initial_55k" : "v1_initial_66k");
  byTemplate[t] = byTemplate[t] || { sent: 0, reply: 0, order: 0 };
  byTemplate[t].sent += 1;
  if (isReply(r)) byTemplate[t].reply += 1;
  if (isOrder(r)) byTemplate[t].order += 1;
}

const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : "—");
const perOrder = orders.length ? (sent.length / orders.length).toFixed(1) : "—";

const summary = {
  as_of: jstDateString(),
  leads_total: rows.length,
  sent: sent.length,
  bounce: bounced.length,
  reply: replies.length,
  reply_rate: sent.length ? replies.length / sent.length : 0,
  a_hope: aHope.length,
  b_hope: bHope.length,
  opt_out_marked: optOut.length,
  meeting: meetings.length,
  quote: quotes.length,
  order: orders.length,
  revenue_yen: revenue,
  sends_per_order: orders.length ? sent.length / orders.length : null,
  by_template: byTemplate,
  recent_sent: sent
    .slice()
    .sort((a, b) => String(b.sent_at).localeCompare(String(a.sent_at)))
    .slice(0, 10)
    .map((r) => ({
      company: r.company,
      sent_at: r.sent_at,
      reply_type: r.reply_type || "",
      bounce_type: r.bounce_type || "",
      order_amount_yen: r.order_amount_yen || "",
    })),
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

const md = `# 工務店 buyout 効果測定（会社単位ファネル）

更新: ${summary.as_of} JST  
正本: \`buyout-ops/demo_buyout_leads.csv\`  
開封率は測らない（\`demo_buyout_metrics.md\`）。

## ファネル

| 指標 | 数 | 備考 |
|---|---:|---|
| リスト総数 | ${summary.leads_total} | approved/paused/sent 含む |
| 送信済 | ${summary.sent} | status=sent または sent_at |
| バウンス記録 | ${summary.bounce} | bounce_at / notes |
| 返信 | ${summary.reply} | reply_type / reply_at |
| 返信率 | ${pct(summary.reply, summary.sent)} | 返信 ÷ 送信 |
| A希望 | ${summary.a_hope} | |
| B希望 | ${summary.b_hope} | |
| 商談(meeting_at) | ${summary.meeting} | |
| 見積(quote_at) | ${summary.quote} | |
| 受注 | ${summary.order} | |
| 売上 | ${summary.revenue_yen.toLocaleString("ja-JP")}円 | |
| 1受注あたり送信 | ${perOrder} | 送信 ÷ 受注 |

\`\`\`
送信 ${summary.sent}
  → 返信 ${summary.reply}（${pct(summary.reply, summary.sent)}）
  → 商談 ${summary.meeting}
  → 受注 ${summary.order}
  → 売上 ${summary.revenue_yen.toLocaleString("ja-JP")}円
\`\`\`

## テンプレ別

| template_version | 送信 | 返信 | 受注 |
|---|---:|---:|---:|
${Object.entries(byTemplate)
  .map(([k, v]) => `| ${k} | ${v.sent} | ${v.reply} | ${v.order} |`)
  .join("\n") || "| （なし） | 0 | 0 | 0 |"}

## 直近の送信（最大10）

| 日付 | 会社 | 返信 | バウンス | 受注額 |
|---|---|---|---|---:|
${summary.recent_sent
  .map(
    (r) =>
      `| ${r.sent_at || "?"} | ${r.company} | ${r.reply_type || "—"} | ${r.bounce_type || "—"} | ${r.order_amount_yen || "—"} |`
  )
  .join("\n")}

## 更新コマンド

\`\`\`bash
node buyout-ops/record-funnel.mjs --company "社名" --reply a_hope
node buyout-ops/record-funnel.mjs --company "社名" --bounce mailbox_full
node buyout-ops/record-funnel.mjs --company "社名" --order 66000
node buyout-ops/metrics-report.mjs --write
\`\`\`
`;

console.log(md);
if (process.argv.includes("--write")) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, md);
  console.error(`Wrote ${outFile}`);
}
