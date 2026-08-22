# デモ買い取り — オーナー承認キュー（人間1回・送信は自動）

> 2026-08-23 確定: **リスト承認は人間1回**。承認後は **approval_seq 順に毎日1通** を自動送信（枯れるまで）。

## 全体像

```
夜（エージェント）  prospect-scan-batch → scan_results.csv (CANDIDATE)
朝（オーナー）      review_queue.csv で owner_ok=y → import-review-approvals
9:00（自動）        先頭 approved をデモ制作 → status=queued
10:00（自動）       先頭 queued を verify → 送信 → sent
翌日以降            同じ（上から1社/日）直到リスト枯れ
```

**毎日の送信確認は不要。** 承認した50社なら50日間、上から順に1社ずつ送る。

---

## 夜 — 候補収集（エージェント）

```bash
cd demos
# 種URLを増やしたうえで（Maps調査 → seeds/koumuten_urls.csv）
caffeinate -i node buyout-ops/prospect-scan-batch.mjs --sleep-ms 2000
node buyout-ops/prepare-review-sheet.mjs
```

- `prospect_pipeline/review_queue.csv` が生成される（CANDIDATE のみ）
- CANDIDATE=0 のときは **種URL不足**。推測で埋めない → 都道府県別Mapsで種を追加

---

## 朝 — オーナー承認（1回）

1. `buyout-ops/prospect_pipeline/review_queue.csv` を開く
2. 送信してよい行の `owner_ok` に `y`（不要な行は空のまま）
3. 任意で `owner_notes` にメモ
4. インポート:

```bash
node buyout-ops/import-review-approvals.mjs --dry-run   # 確認
node buyout-ops/import-review-approvals.mjs             # demo_buyout_leads に status=approved
git add buyout-ops/demo_buyout_leads.csv && git commit && git push   # オーナー指示時
```

- `approval_seq` 列の順が送信順（上から1,2,3…）
- 承認行は `demo_buyout_leads.csv` に `status=approved` で入る（デモURLは空）

---

## 9:00 — デモ制作（自動・承認キューのみ）

`refill-queue-if-empty.mjs` の流れ:

| 状態 | 動作 |
|---|---|
| sendable > 0 | 何もしない（10:00へ） |
| approved が残っている | **seq最小の1社** だけ Hunter/デモ制作 |
| 承認キューなし | paused 昇格（レガシー）→ それもなければ **待機** |

### エージェント手順（exit 3 = build）

1. `node buyout-ops/next-approved.mjs` で社名確認
2. [`demo_buyout_hunter.md`](./demo_buyout_hunter.md) G0〜G5 / C0〜C5（承認済でも G1 再確認）
3. `verify-hunter-g1.mjs --from-csv --company "…"` PASS
4. swap → publish → buyout-prospects push
5. CSV: `status=queued`, `demo_url_a/b` 記入（**approval_seq は変えない**）
6. `verify-before-send.mjs` PASS → commit & push（10:00前）

**承認リスト外の hunter-suggest は使わない**（オーナー未承認の勝手送信防止）。

---

## 10:00 — 送信（自動・確認不要）

[`demo_buyout_autorun.md`](./demo_buyout_autorun.md) どおり。

- `queue-status.mjs` → **approval_seq 最小** の sendable 行が `next_send`
- verify PASS → 初回メール1通 → `status=sent`
- sendable=0 なら送らない

---

## 状態一覧

| status | 意味 |
|---|---|
| （review_queue） | スキャン候補・未承認 |
| `approved` | オーナー承認済・デモ未 |
| `queued` | デモURLあり・送信待ち |
| `sent` | 初回送信済 |
| `paused` | 停止（G1見送り・Phase2・blocklist等） |

---

## コマンド早見

```bash
node buyout-ops/queue-status.mjs --json
node buyout-ops/next-approved.mjs
node buyout-ops/import-review-approvals.mjs --dry-run
```

---

## レート

- **1日1通**（週最大7・土日含む）— ドメイン warmup（`hello@calcite-ai.jp`）
- 50社承認 → 約50営業日で消化（週7なら約7週）

---

## 関連

- 夜間パイプライン: [`demo_buyout_prospect_pipeline.md`](./demo_buyout_prospect_pipeline.md)
- 日次9/10時: [`demo_buyout_daily_schedule.md`](./demo_buyout_daily_schedule.md)
- 送信本体: [`demo_buyout_autorun.md`](./demo_buyout_autorun.md)
