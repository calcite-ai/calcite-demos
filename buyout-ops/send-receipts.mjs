/**
 * Append-only send receipts. Survives a failed "mark sent" git push when the
 * Actions cache copy is restored, and is the CSV-independent duplicate check.
 *
 * 由来: 2026-09-04 有限会社佐藤工務店へ 09:12 送信後、mark-sent push が
 * non-fast-forward で落ち、14:17 の catch-up が同一本文を再送した。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function jstDateString(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const RECEIPTS_PATH = path.join(__dirname, "send-receipts.jsonl");
export const RECEIPTS_CACHE_PATH = path.join(__dirname, ".send-receipts-cache.jsonl");

function readJsonl(file) {
  if (!file || !fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const row = JSON.parse(line);
        if (!row || typeof row !== "object") return [];
        return [row];
      } catch {
        return [];
      }
    });
}

export function loadReceipts() {
  const extra = String(process.env.BUYOUT_SEND_RECEIPTS_CACHE || "").trim();
  return [...readJsonl(RECEIPTS_PATH), ...readJsonl(RECEIPTS_CACHE_PATH), ...readJsonl(extra)];
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/** True if this address already received outreach (optionally on/after a JST date). */
export function hasSentTo(email, { sinceDate = "" } = {}) {
  const e = normalizeEmail(email);
  if (!e) return false;
  const since = String(sinceDate || "").slice(0, 10);
  return loadReceipts().some((r) => {
    if (normalizeEmail(r.email) !== e) return false;
    if (since && String(r.jst || "").slice(0, 10) < since) return false;
    return true;
  });
}

export function appendReceipt({ company, email, messageId, track = "buyout" }) {
  const row = {
    at: new Date().toISOString(),
    jst: jstDateString(),
    track,
    company: String(company || "").trim(),
    email: normalizeEmail(email),
    messageId: String(messageId || "").trim(),
  };
  if (!row.email) return row;
  const line = JSON.stringify(row) + "\n";
  fs.appendFileSync(RECEIPTS_PATH, line);
  if (process.env.GITHUB_ACTIONS === "true") {
    fs.appendFileSync(RECEIPTS_CACHE_PATH, line);
  }
  return row;
}
