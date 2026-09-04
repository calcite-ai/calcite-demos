/**
 * Shared outreach idempotency — never re-approve or re-send a lead that
 * already left the pool (sent / opt_out / paused) or that has send evidence.
 */
import { hasSentTo } from "./send-receipts.mjs";

export const TERMINAL_LEAD_STATUSES = new Set(["sent", "opt_out", "paused"]);

/** Prefer sent_at; else notes 「初回送信」/「初回送信済」YYYY-MM-DD */
export function parseOutreachSentDate(row) {
  if (row?.sent_at) return String(row.sent_at).slice(0, 10);
  const blob = `${row?.notes || ""} ${row?.owner_approved_at || ""}`;
  const m = blob.match(/初回送信(?:済)?\s+(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

/** True if this lead must never be treated as a fresh approved send candidate. */
export function isAlreadyOutreached(row) {
  if (!row) return false;
  const st = String(row.status || "").trim();
  if (TERMINAL_LEAD_STATUSES.has(st)) return true;
  if (String(row.sent_at || "").trim()) return true;
  if (parseOutreachSentDate(row)) return true;
  if (hasSentTo(row.email)) return true;
  return false;
}

export function preserveLeadStatus(existing, fallback) {
  if (existing && TERMINAL_LEAD_STATUSES.has(String(existing.status || "").trim())) {
    return String(existing.status).trim();
  }
  return fallback;
}
