/**
 * 送信可能な時間帯（JST）。工務店への初回営業なので日中に限る。
 *
 * cron の予備は 15:00 JST までだが、送信ワークフローは
 * demo_buyout_leads.csv / buyout-prospects への push でも発火するため、
 * 深夜の push がそのまま深夜送信になる。
 * 2026-09-05 は手動 dispatch で 21:31 JST に送信された。
 *
 * BUYOUT_SEND_HOURS="9-18" で上書き、"off" で無効化（検証用）。
 */
export function outsideSendWindow(now = new Date()) {
  const spec = String(process.env.BUYOUT_SEND_HOURS || "9-18").trim();
  if (spec === "off") return null;
  const m = spec.match(/^(\d{1,2})-(\d{1,2})$/);
  const [from, to] = m ? [Number(m[1]), Number(m[2])] : [9, 18];
  const hour =
    Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Tokyo",
        hour: "numeric",
        hour12: false,
      }).format(now)
    ) % 24;
  if (hour >= from && hour < to) return null;
  return { hour, from, to };
}

/** skip 時の1行メッセージ */
export function sendWindowSkipLine(off) {
  return `RESULT skip — 営業時間外 (${off.hour}時 JST / 送信可 ${off.from}-${off.to}時)。次の cron で再試行`;
}
