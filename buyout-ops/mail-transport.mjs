/**
 * Shared SMTP transport for buyout outreach / inbox replies.
 *
 * BUYOUT_MAIL_PROVIDER=conoha|sendgrid  （未設定時は conoha。APIキー有無では切替しない）
 *
 * ConoHa IMAP mailbox password stays in BUYOUT_SMTP_PASS even when outbound is SendGrid.
 * SendGrid auth uses SENDGRID_API_KEY (user=apikey).
 */
export function resolveProvider() {
  const raw = String(process.env.BUYOUT_MAIL_PROVIDER || "")
    .trim()
    .toLowerCase();
  if (raw === "sendgrid") return "sendgrid";
  if (raw === "conoha") return "conoha";
  const host = String(process.env.BUYOUT_SMTP_HOST || "").toLowerCase();
  if (host.includes("sendgrid")) return "sendgrid";
  return "conoha";
}

/**
 * @returns {{ provider: string, fromUser: string, host: string, port: number, user: string, pass: string }}
 */
export function resolveTransport() {
  const provider = resolveProvider();
  const fromUser = requireEnv("BUYOUT_SMTP_USER");

  if (provider === "sendgrid") {
    const pass = process.env.SENDGRID_API_KEY || process.env.BUYOUT_SMTP_PASS;
    if (!pass) {
      console.error("FAIL missing SENDGRID_API_KEY (or BUYOUT_SMTP_PASS for SendGrid)");
      process.exit(1);
    }
    const hostOverride = String(process.env.BUYOUT_SMTP_HOST || "").trim();
    const host =
      hostOverride && hostOverride.toLowerCase().includes("sendgrid")
        ? hostOverride
        : "smtp.sendgrid.net";
    return {
      provider: "sendgrid",
      fromUser,
      host,
      port: Number(process.env.BUYOUT_SMTP_PORT || "465"),
      user: "apikey",
      pass,
    };
  }

  return {
    provider: "conoha",
    fromUser,
    host: process.env.BUYOUT_SMTP_HOST || "mail1004.conoha.ne.jp",
    port: Number(process.env.BUYOUT_SMTP_PORT || "465"),
    user: fromUser,
    pass: requireEnv("BUYOUT_SMTP_PASS"),
  };
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`FAIL missing env ${name}`);
    process.exit(1);
  }
  return v;
}
