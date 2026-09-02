/**
 * SendGrid SMTP headers for outreach.
 * HTML click tracking ON (demos). Plain-text link rewriting OFF.
 * Open tracking OFF.
 */
export function sendgridSmtpHeaders() {
  if (String(process.env.BUYOUT_MAIL_PROVIDER || "").trim().toLowerCase() !== "sendgrid") {
    return {};
  }
  const payload = {
    filters: {
      clicktrack: { settings: { enable: 1, enable_text: false } },
      opentrack: { settings: { enable: 0 } },
    },
  };
  return { "X-SMTPAPI": JSON.stringify(payload) };
}
