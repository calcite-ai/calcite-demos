/**
 * オーナー宛の控えを「別メッセージ」として送る。
 *
 * BCC では同一メッセージになるため、控えだけ追跡を外すことができない。
 * 控えを開く・デモリンクを踏むたびに営業先の開封/クリックへ混入するので、
 * 送信は分ける。追跡は両方オフ。
 *
 * 控えの失敗で営業送信そのものを失敗させない（本文は既に届いている）。
 */
import { sendgridSmtpHeaders } from "./sendgrid-smtp-headers.mjs";

export const OWNER_ARCHIVE = "kenta.hino1106@gmail.com";

export function archiveRecipient() {
  return String(process.env.BUYOUT_BCC || OWNER_ARCHIVE).trim();
}

export async function sendArchiveCopy(transporter, { from, to, subject, text, html }) {
  const rcpt = archiveRecipient();
  if (!rcpt) return { skipped: "recipient未設定" };
  // 控えが営業先へ飛ぶと同じ相手に2通届く。BUYOUT_BCC の設定ミスでも起きないよう塞ぐ。
  if (rcpt.toLowerCase() === String(to || "").trim().toLowerCase()) {
    return { skipped: `控えの宛先が営業先と同一 (${rcpt}) — 2通目を送らない` };
  }
  try {
    const msg = {
      from,
      to: rcpt,
      subject: `[控え] ${subject}`,
      text: `※ この控えは追跡なしの別送です。宛先: ${to}\n\n${text}`,
      headers: sendgridSmtpHeaders({ track: false }),
    };
    if (html) msg.html = html;   // インサイドはテキストのみ
    const info = await transporter.sendMail(msg);
    return { messageId: info.messageId || info.response || "" };
  } catch (err) {
    return { error: err?.response || err?.message || String(err) };
  }
}
