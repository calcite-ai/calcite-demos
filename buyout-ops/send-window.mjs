/**
 * 送信可能な時間帯（JST）。工務店への初回営業なので日中に限る。
 *
 * cron の予備は 15:00 JST までだが、送信ワークフローは
 * demo_buyout_leads.csv / buyout-prospects への push でも発火するため、
 * 深夜の push がそのまま深夜送信になる。
 * 2026-09-05 は手動 dispatch で 21:31 JST に送信された。
 *
 * BUYOUT_SEND_HOURS="9-18" で上書き、"off" で無効化（検証用）。
 *
 * 2026-10-09判明: GitHub Actions の cron 発火自体が数時間〜半日単位で遅延し、
 * 10:00/11:00/12:00/13:00/15:00 JST 狙いの5スロット全てが実際には夕方
 * （15:49〜21:14 JST）にずれ込み、どれも9-18時の枠に入らず「今日は0件」の
 * まま終わる事故が10/7〜10/9に発生（それ以前の9/30〜10/7は正常に送れていた）。
 * cronの発火タイミング自体は直せないため、「本日まだ1件も送れていないまま
 * 夕方（18時）を過ぎた」場合に限り、22時までは当日分の取り戻し送信を許可する
 * （BUYOUT_CATCH_UP_UNTIL で上書き可）。深夜（22-9時）は従来どおり送らない。
 */
export function outsideSendWindow(now = new Date(), opts = {}) {
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

  if (opts.allowCatchUp) {
    const catchUpUntil = Number(process.env.BUYOUT_CATCH_UP_UNTIL || 22);
    if (hour >= to && hour < catchUpUntil) {
      return null;
    }
  }

  return { hour, from, to };
}

/** skip 時の1行メッセージ */
export function sendWindowSkipLine(off) {
  return `RESULT skip — 営業時間外 (${off.hour}時 JST / 送信可 ${off.from}-${off.to}時)。次の cron で再試行`;
}
