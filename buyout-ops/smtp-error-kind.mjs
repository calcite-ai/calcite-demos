/**
 * Classify SMTP / bounce failures for buyout send failover.
 *
 * - recipient: pause this lead, try next company (same-day)
 * - spam / auth / unknown: stop the whole run (do NOT keep blasting)
 * - transient: skip this lead for now (keep queued), try next
 */

export function classifySmtpError(err) {
  const code = Number(err?.responseCode) || 0;
  const msg = `${err?.response || ""} ${err?.message || ""} ${code}`.toLowerCase();

  if (/invalid login|authentication|auth failed|535|534/.test(msg) || code === 535 || code === 534) {
    return "auth";
  }
  // ConoHa / GMO: GitHub Actions (US) blocked when 国外IP制限 is ON
  if (/incorrect country code|country code|国外/.test(msg)) {
    return "geo";
  }
  if (
    /spam|junk|blacklist|blocklist|reputation|policy violation|content rejected|5\.7\.|rejected as spam/.test(
      msg
    )
  ) {
    return "spam";
  }
  if (
    /mailbox full|quota exceeded|user unknown|no such user|does not exist|5\.1\.1|5\.2\.1|5\.2\.2|552|553|550.*recipient|551/.test(
      msg
    ) ||
    code === 552 ||
    code === 553 ||
    code === 551
  ) {
    return "recipient";
  }
  if (/timeout|temporar|try again|421|450|451|452|4\.\d/.test(msg) || (code >= 400 && code < 500)) {
    return "transient";
  }
  return "unknown";
}

/** Bounce / DSN body → same kinds (spam-like DSN must not trigger failover blast). */
export function classifyBounceText(bodyText = "") {
  const t = String(bodyText).toLowerCase();
  if (/spam|blacklist|blocklist|reputation|policy|rejected.*content|5\.7\./.test(t)) {
    return "spam";
  }
  if (/mailbox full|quota exceeded|5\.2\.2|552/.test(t)) {
    return "mailbox_full";
  }
  if (/user unknown|no such user|5\.1\.1|does not exist|550/.test(t)) {
    return "hard";
  }
  return "soft";
}

/** Exit codes from send-outreach-smtp.mjs */
export const SMTP_EXIT = {
  recipient: 12,
  transient: 13,
  spam: 10,
  auth: 11,
  geo: 15,
  unknown: 14,
};

export function exitCodeForKind(kind) {
  return SMTP_EXIT[kind] || SMTP_EXIT.unknown;
}

/** Bounce types that free today's quota and allow same-day replacement send. */
export function bounceAllowsFailover(bounceType) {
  return bounceType === "mailbox_full" || bounceType === "hard" || bounceType === "soft";
}
