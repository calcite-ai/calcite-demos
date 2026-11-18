/**
 * 送信対象の業種（vertical）。
 *   koumuten … 工務店・建設（スキン e-taisei）
 *   shigyo   … 士業（行政書士・司法書士・社労士・税理士・土地家屋調査士。スキン g-shigyo）
 * 2026-11-18: 工務店の在庫が枯れたため士業を追加。新しい業種を足すときは、
 * 雛形（designs/<skin>）・メール文面・本文ゲートが揃ってから ACTIVE_VERTICALS に入れる。
 */
export const ACTIVE_VERTICALS = ["koumuten", "shigyo"];
/** 後方互換: 表示・hunter-suggest（工務店向け探索）が参照する「主」業種 */
export const ACTIVE_VERTICAL = ACTIVE_VERTICALS[0];

const VERTICAL_LABELS = {
  koumuten: "工務店・建設",
  shigyo: "士業",
  zeirishi: "税理士・会計（旧・雛形なし）",
  sougi: "葬儀",
  other: "その他",
};

/** 士業の資格名。屋号・事務所名に含まれるときは士業として扱う */
export const SHIGYO_RE =
  /行政書士|司法書士|社会保険労務士|社労士|土地家屋調査士|調査士|税理士|公認会計士|弁理士|弁護士|海事代理士|中小企業診断士/;

export function inferVertical(row) {
  const text = `${row.company || ""} ${row.pay_signals || ""} ${row.audit_notes || ""}`;
  if (SHIGYO_RE.test(row.company || "")) return "shigyo";
  if (/税理士|会計事務|zeirishi|kobazei|accountant/i.test(text)) return "zeirishi";
  if (/葬儀|祭典|sougi|会館/i.test(text)) return "sougi";
  if (/工務|建設|工房|koumuten|建築/i.test(text)) return "koumuten";
  return "other";
}

export function rowVertical(row) {
  const v = String(row.vertical || "").trim();
  if (v && VERTICAL_LABELS[v]) return v;
  return inferVertical(row);
}

export function isActiveVertical(row) {
  return ACTIVE_VERTICALS.includes(rowVertical(row));
}

export function verticalLabel(v) {
  return VERTICAL_LABELS[v] || v;
}

export function activeVerticalsLabel() {
  return ACTIVE_VERTICALS.map((v) => `${v}(${verticalLabel(v)})`).join("+");
}
