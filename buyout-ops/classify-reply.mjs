/**
 * Classify inbound buyout reply body (Japanese outreach).
 * Returns reply_type used by record-funnel / metrics.
 */
export function classifyReplyBody(text) {
  const raw = String(text || "").replace(/\r/g, "");
  if (!raw.trim()) return "other";

  if (/配信停止|今後\s*送ら|メール.*不要|案内.*不要|配信.*不要|unsubscribe/i.test(raw)) {
    return "opt_out";
  }
  if (/結構です|不要です|見送り|興味.*ありません|営業.*お断り|配信停止/.test(raw)) {
    return "decline";
  }
  if (/[AＡ]希望|案\s*[AＡ]|デモ\s*[AＡ]|A案|Ａ案/.test(raw)) return "a_hope";
  if (/[BＢ]希望|案\s*[BＢ]|デモ\s*[BＢ]|B案|Ｂ案/.test(raw)) return "b_hope";
  if (/購入希望|買いたい|買い取り.*希望|買取.*希望|決済.*お願い|この内容で|進めて|契約した/.test(raw)) {
    return "buy";
  }
  if (/デザイン変更|ページ追加|カスタム|ゼロから|作り込み|もっと作り/.test(raw)) {
    return "custom";
  }
  if (/納期|ドメイン|サーバー|何が含まれる|修正|写真|料金|価格|いくら|GEO|SEO/.test(raw)) {
    return "question";
  }
  if (/検討|また連絡|忙しい|後で/.test(raw)) return "decline";
  return "other";
}

export function isPurchaseIntent(replyType) {
  return replyType === "a_hope" || replyType === "b_hope" || replyType === "buy";
}

export function selectedDemoLabel(replyType) {
  if (replyType === "a_hope") return "A";
  if (replyType === "b_hope") return "B";
  return "";
}
