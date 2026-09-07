/**
 * SendGrid SMTP headers for outreach.
 *
 * 営業本文（track: true）:
 *   クリック追跡 ON（HTMLのデモリンクのみ。text/plain は書き換えない）
 *   開封追跡 ON  ← 2026-09-07 有効化。オフの間は「開封0」が測定漏れなのか
 *                  本当に開かれていないのか区別できなかった。
 *
 * 控え・返信・テスト（track: false）:
 *   両方 OFF。オーナー宛の控えを追跡すると、自分で開いた分が
 *   営業先の数字に混ざる（2026-09-07 に発覚。クリック23件が全て控え由来だった）。
 */
export function sendgridSmtpHeaders({ track = true } = {}) {
  if (String(process.env.BUYOUT_MAIL_PROVIDER || "").trim().toLowerCase() !== "sendgrid") {
    return {};
  }
  const payload = {
    filters: {
      clicktrack: { settings: { enable: track ? 1 : 0, enable_text: false } },
      opentrack: { settings: { enable: track ? 1 : 0 } },
    },
  };
  return { "X-SMTPAPI": JSON.stringify(payload) };
}
