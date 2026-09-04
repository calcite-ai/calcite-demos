# デモ買い取り — クラウド自動営業用

正本（日次エージェントが読む場所）:

| ファイル | 用途 |
|---|---|
| `demo_buyout_metrics.md` | **効果測定**（会社単位ファネル・開封率は測らない） |
| `send-quota.csv` / `send-quota.mjs` | **1日の送信通数**（日付で切替。途中から行を足す） |
| `demo_buyout_daily_schedule.md` | **9:00 デモ制作 / 10:00 送信** |
| `demo_buyout_autorun.md` | 10:00 送信オペ |
| `prospect-rescan-fetch-fail.mjs` | 9:00 FETCH_FAIL 再試行 |
| `prepare-review-sheet.mjs` | 夜スキャン → 朝レビュー用 CSV |
| `import-review-approvals.mjs` | owner_ok=y → leads (status=approved) |
| `next-approved.mjs` | 承認キュー先頭1社（9:00 デモ用） |
| `prior_outreach_blocklist.csv` | **過去デモ営業済み**（再送禁止リスト） |
| `prior-outreach.mjs` | blocklist 照合 |
| `refill-queue-if-empty.mjs` | 9:00 オーケストレータ |
| `queue-status.mjs` | 送付先件数 |
| `demo_buyout_leads.csv` | 送信キュー |
| `demo_buyout_pre_send_checklist.md` | **送信前ゲート（必須）** |
| `verify-before-send.mjs` | 送信前の機械チェック（404・アオイ残存など） |
| `verify-demo-content.mjs` | **本文ゲート**（転記・デモ表記・架空代表。FACTは先方HPで手照合） |
| `verify-recipient.mjs` | **宛先実在確認**（MX + SMTP RCPT / DATA は送らない）。V17 が利用 |
| `audit-recipients.mjs` | 既存リードの宛先を一括検証。dead のみ送信プールから除外 |
| `sync-sendgrid-bounces.mjs` | SendGrid 抑制リスト → CSV（送信後に実行） |
| `verify-hunter-g1.mjs` | **G1必須**（モダンサイト除外・queued前） |
| `site-g1-eval.mjs` | G1判定ロジック（上記から利用） |
| `demo_buyout_prospect_pipeline.md` | **全国リスト収集**（夜間スキャン手順） |
| `prospect-scan-batch.mjs` | 夜間: 種URL → scan_results.csv（C1: http種でも https を試す） |
| `inside_sales_campaign_routing.md` | **インサイド PoC** — 商材振り分け（HP/採用/AI） |
| `campaign-score.mjs` | 商材スコア・トラック判定 |
| `enrich-scan-campaign.mjs` | inside候補の採用/AIシグナル深掘り |
| `split-scan-tracks.mjs` | buyout / inside リスト分割 |
| `run-campaign-pipeline.mjs` | merge → enrich → split → review 一括 |
| `inside_sales_poc_leads.csv` | インサイド PoC 候補プール |
| `import-inside-approvals.mjs` | inside owner_ok=y → approved |
| `inside-hp-signals.mjs` | hp_improve 観察文・スコア用シグナル |
| `templates/email_inside_hp_improve_1_initial.txt` | インサイド初回（信頼設計・発注者目線） |
| `prospect-rescan-https.mjs` | 既存 SSL未整備行の C1 再判定 |
| `extract-seeds-from-prospects.mjs` | prospects → seeds 同期 |
| `demo_buyout_audit_checklist.md` | 誤診防止 |
| `demo_buyout_hunter.md` | 収集ゲート G0〜G5 / C0〜C5 |
| `demo_buyout_publish.md` | Pages 公開 |
| `templates/email_demo_buyout_1_initial.txt` | 初回メール |

ローカルの `02_hp-sales/sales/knowledge/` と同期すること。変更したらここも更新して push。  
Hunter 用リスト: `buyout-ops/sales_prospects.csv`（クラウド Automation が読む正本）

送信前:

```bash
node buyout-ops/verify-demo-content.mjs --from-csv --company "株式会社〇〇"
node buyout-ops/verify-before-send.mjs --from-csv --company "株式会社〇〇"
# PASS 以外は送らない。本文ゲートの FACT 行は先方HPで潰す
```
