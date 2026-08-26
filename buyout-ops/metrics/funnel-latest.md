# 工務店 buyout 効果測定（会社単位ファネル）

更新: 2026-08-26 JST  
正本: `buyout-ops/demo_buyout_leads.csv`  
開封率は測らない（`demo_buyout_metrics.md`）。

## ファネル

| 指標 | 数 | 備考 |
|---|---:|---|
| リスト総数 | 47 | approved/paused/sent 含む |
| 送信済 | 6 | status=sent または sent_at |
| バウンス記録 | 1 | bounce_at / notes |
| 返信 | 0 | reply_type / reply_at |
| 返信率 | 0.0% | 返信 ÷ 送信 |
| A希望 | 0 | |
| B希望 | 0 | |
| 商談(meeting_at) | 0 | |
| 見積(quote_at) | 0 | |
| 受注 | 0 | |
| 売上 | 0円 | |
| 1受注あたり送信 | — | 送信 ÷ 受注 |

```
送信 6
  → 返信 0（0.0%）
  → 商談 0
  → 受注 0
  → 売上 0円
```

## テンプレ別

| template_version | 送信 | 返信 | 受注 |
|---|---:|---:|---:|
| v1_initial_55k | 3 | 0 | 0 |
| v1_initial_66k | 3 | 0 | 0 |

## 直近の送信（最大10）

| 日付 | 会社 | 返信 | バウンス | 受注額 |
|---|---|---|---|---:|
| 2026-08-26 | 村上工務店 | — | — | — |
| 2026-08-25 | 株式会社ビルドテクト | — | — | — |
| 2026-08-24 | 株式会社中村工務店 | — | — | — |
| 2026-08-22 | 株式会社日南工務店 | — | — | — |
| 2026-08-21 | 株式会社福澤工務店 | — | — | — |
| 2026-08-20 | 株式会社新見工務店 | — | — | — |

## 更新コマンド

```bash
node buyout-ops/record-funnel.mjs --company "社名" --reply a_hope
node buyout-ops/record-funnel.mjs --company "社名" --bounce mailbox_full
node buyout-ops/record-funnel.mjs --company "社名" --order 66000
node buyout-ops/metrics-report.mjs --write
```
