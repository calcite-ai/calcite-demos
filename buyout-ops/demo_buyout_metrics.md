# デモ買い取り — 効果測定（会社単位ファネル）

> 2026-08-26 開始。ChatGPT指示書の「開封率ではなく会社単位ファネル」を、既存 CSV で最小実装する。  
> **大量送信用の新システムは作らない。** 少ない送信で学習する。

## 正本

| ファイル | 役割 |
|---|---|
| [`demo_buyout_leads.csv`](./demo_buyout_leads.csv) | 会社単位の状態（送信・バウンス・返信・受注） |
| [`metrics-report.mjs`](./metrics-report.mjs) | ファネル集計 |
| [`record-funnel.mjs`](./record-funnel.mjs) | 返信／バウンス／受注の記録 |
| [`migrate-metrics-columns.mjs`](./migrate-metrics-columns.mjs) | 列追加・sent_at バックフィル |
| [`metrics/funnel-latest.md`](./metrics/funnel-latest.md) | 最新レポート（`--write` で更新） |

## 測るもの / 測らないもの

| 測る | 測らない（当面） |
|---|---|
| 送信数・バウンス・返信・A/B希望 | 開封率 |
| 商談・見積・受注・売上 | クリック＝人が見た、という断定 |
| テンプレ別の返信 | 別DBのフルダッシュボード |

## 追加列（CSV）

| 列 | 意味 |
|---|---|
| `sent_at` | 初回送信日 `YYYY-MM-DD` |
| `bounce_at` / `bounce_type` | バウンス日 / `hard` `soft` `mailbox_full` |
| `reply_at` / `reply_type` | 返信日 / `a_hope` `b_hope` `question` `custom` `decline` `opt_out` `other` |
| `meeting_at` | 商談化日 |
| `quote_at` | 見積提出日 |
| `order_at` / `order_amount_yen` | 受注日・税込円 |
| `template_version` | 例 `v1_initial_66k` |

## 運用（返信が来たら）

```bash
# A希望
node buyout-ops/record-funnel.mjs --company "村上工務店" --reply a_hope

# 配信停止
node buyout-ops/record-funnel.mjs --company "…" --opt-out

# バウンス
node buyout-ops/record-funnel.mjs --company "株式会社基工務店" --bounce mailbox_full

# 受注（税込）
node buyout-ops/record-funnel.mjs --company "…" --order 66000

# レポート更新
node buyout-ops/metrics-report.mjs --write
```

決済URL送付・素材回収・制作は従来どおり [`demo_buyout_inbox.md`](./demo_buyout_inbox.md)。  
このファイルは **数字を残す層** だけを担当する。

## 週次（推奨）

1. `node buyout-ops/metrics-report.mjs --write`
2. `funnel-latest.md` を見て返信率・ボトルネックを1行メモ
3. 通数を増やす判断は `send-quota.csv` を人間が変更（自動増枠しない）
