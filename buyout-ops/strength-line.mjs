/**
 * pay_signals をメール・デモ audit 用の「人が書いた強み1行」に整える。
 * 事実は pay_signals からのみ。推測で足さない。
 */

function mapToken(token) {
  const t = String(token || "").trim();
  if (!t) return "";

  if (/0120/.test(t)) return "0120番号での問い合わせ受付";
  if (/公共工事/.test(t)) return "公共工事の実績";
  const years = t.match(/業歴(?:約)?(\d+)年/);
  if (years) return `約${years[1]}年の業歴`;
  const founded = t.match(/(\d{4})年設立/);
  if (founded) return `${founded[1]}年からの事業継続`;
  if (/創業昭和(\d+)/.test(t)) return "創業から続く地域での信頼";
  if (/創業(\d{4})/.test(t)) return "創業からの地域での実績";
  if (/一級建築士/.test(t)) return "一級建築士事務所としての設計力";
  if (/資本金/.test(t)) return "法人としての事業基盤";
  if (/建設業許可|知事許可|許可/.test(t)) return "建設業許可に基づく施工";
  if (/法人/.test(t) && t.length <= 6) return "法人としての事業体制";
  if (/ハウスプラス|工務店|建設|事務所/.test(t) && t.length <= 12) return null;
  if (/^法人$|^中小$/.test(t)) return null;

  if (t.length <= 20) return t;
  return null;
}

/** メール {強み1行} — 読みやすい1文 */
export function humanStrengthLine({ pay_signals = "" } = {}) {
  const raw = String(pay_signals || "").trim();
  if (!raw) return "地域で施工を手がれる実力がある";

  const phrases = [];
  for (const token of raw.split(/[、,]/).map((s) => s.trim()).filter(Boolean)) {
    const mapped = mapToken(token);
    if (!mapped || phrases.includes(mapped)) continue;
    phrases.push(mapped);
    if (phrases.length >= 2) break;
  }

  if (!phrases.length) return "地域で施工を手がれる実力がある";
  if (phrases.length === 1) return `${phrases[0]}がうかがえる`;
  return `${phrases[0]}や${phrases[1]}がうかがえる`;
}

/** デモ audit リード — 名詞句を列挙 */
export function humanStrengthAudit({ pay_signals = "" } = {}) {
  const raw = String(pay_signals || "").trim();
  if (!raw) return "地域で施工を手がれる実力";

  const phrases = [];
  for (const token of raw.split(/[、,]/).map((s) => s.trim()).filter(Boolean)) {
    const mapped = mapToken(token);
    if (!mapped || phrases.includes(mapped)) continue;
    phrases.push(mapped);
    if (phrases.length >= 2) break;
  }

  if (!phrases.length) return "地域で施工を手がれる実力";
  return phrases.join("、");
}
