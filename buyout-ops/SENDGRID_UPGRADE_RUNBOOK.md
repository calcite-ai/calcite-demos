# SendGrid Essentials upgrade runbook (trial ends 2026-10-29)

> In-repo copy for agents on `calcite-demos`. Full notes also live under HP sales knowledge.

## Decision (locked 2026-08-31)

**B — execute ~2026-10-15** (per Goal text). Do not upgrade early unless the owner says otherwise.
Paid spend still needs owner approval on the day.

Agent work until then is complete: watch cron, secrets, runbook, issue #8.
Blocked items: SendGrid dashboard login (2FA/billing) + Essentials purchase on ~10/15.

## Dates

| When | What |
|---|---|
| **2026-10-08** | Plan-watch starts failing if account still `free` (Mon cron) |
| **~2026-10-15** | Owner upgrades Email API → **Essentials 50K (~$19.95/mo)** |
| **2026-10-29** | Trial ends — sending stops if still free |

Issue: https://github.com/calcite-ai/calcite-demos/issues/8  
Verify plan: `node buyout-ops/check-sendgrid-plan.mjs` (needs `SENDGRID_API_KEY`)

## Blockers (owner only)

Paid contract needs owner approval. Dashboard login required for:

1. Two-factor auth
2. Payment method
3. Change Plan → Essentials

Agent cannot complete upgrade without an authenticated SendGrid session + spend approval.

## Upgrade steps (owner, ~10/15)

1. https://app.sendgrid.com/settings/account → Your Products  
2. Email API → **Change Plan** → **Essentials** (50K) → pay  
3. `node buyout-ops/sendgrid-test-send.mjs --to kennta80@yahoo.co.jp`  
4. Confirm `node buyout-ops/check-sendgrid-plan.mjs` shows non-`free`  
5. Update `_docs/subscriptions.md` + close issue #8  
6. Mark Cursor Goal complete only after step 4

## Pre-checks already done (2026-08-31)

- [x] Domain Auth for `calcite-mail.jp`
- [x] Local + Actions SMTP path (`BUYOUT_MAIL_PROVIDER=sendgrid`)
- [x] `SENDGRID_API_KEY` repo secret (watch only; outbound stays ConoHa until 9/11 cutover)
- [x] Plan watch workflow smoke-tested
- [ ] 2FA / billing / Essentials purchase

## Do not

- Upgrade Marketing Campaigns (not needed)
- Replace `BUYOUT_SMTP_PASS` with the API key (breaks ConoHa IMAP)
- Mark the upgrade Goal complete while `GET /v3/user/account` → `type` is still `free`
