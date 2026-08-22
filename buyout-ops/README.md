# デモ買い取り — クラウド自動営業用

正本（日次エージェントが読む場所）:

| ファイル | 用途 |
|---|---|
| `demo_buyout_daily_schedule.md` | **9:00 キュー補充 / 10:00 送信** |
| `demo_buyout_autorun.md` | 10:00 送信オペ |
| `refill-queue-if-empty.mjs` | 9:00 オーケストレータ |
| `queue-status.mjs` | 送付先件数 |
| `demo_buyout_leads.csv` | 送信キュー |
| `demo_buyout_pre_send_checklist.md` | **送信前ゲート（必須）** |
| `verify-before-send.mjs` | 送信前の機械チェック（404・アオイ残存など） |
| `demo_buyout_audit_checklist.md` | 誤診防止 |
| `demo_buyout_hunter.md` | 収集ゲート G0〜G5 / C0〜C5 |
| `demo_buyout_publish.md` | Pages 公開 |
| `templates/email_demo_buyout_1_initial.txt` | 初回メール |

ローカルの `02_hp-sales/sales/knowledge/` と同期すること。変更したらここも更新して push。  
Hunter 用リスト: `buyout-ops/sales_prospects.csv`（クラウド Automation が読む正本）

送信前:

```bash
node buyout-ops/verify-before-send.mjs --from-csv --company "株式会社〇〇"
# PASS 以外は送らない
```
