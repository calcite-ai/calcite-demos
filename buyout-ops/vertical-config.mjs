/**
 * Active outreach vertical (Phase 1: 工務店 only).
 * Change ACTIVE_VERTICAL when zeirishi/sougi templates are ready.
 */
export const ACTIVE_VERTICAL = "koumuten";

const VERTICAL_LABELS = {
  koumuten: "工務店・建設",
  zeirishi: "税理士・会計",
  sougi: "葬儀",
  other: "その他",
};

export function inferVertical(row) {
  const text = `${row.company || ""} ${row.pay_signals || ""} ${row.audit_notes || ""}`;
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
  return rowVertical(row) === ACTIVE_VERTICAL;
}

export function verticalLabel(v) {
  return VERTICAL_LABELS[v] || v;
}
