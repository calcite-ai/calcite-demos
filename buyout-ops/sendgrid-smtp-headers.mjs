/**
 * SendGrid SMTP: disable click/open tracking so links stay direct (no url####.calcite-mail.jp/wf/click…).
 * Applies only when provider=sendgrid.
 */
export function sendgridSmtpHeaders() {
  if (String(process.env.BUYOUT_MAIL_PROVIDER || "").trim().toLowerCase() !== "sendgrid") {
    return {};
  }
  const payload = {
    filters: {
      clicktrack: { settings: { enable: 0, enable_text: false } },
      opentrack: { settings: { enable: 0 } },
    },
  };
  return { "X-SMTPAPI": JSON.stringify(payload) };
}
