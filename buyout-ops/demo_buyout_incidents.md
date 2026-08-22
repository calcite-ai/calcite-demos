# デモ買い取り — 再発防止（インシデント記録）

> 同種ミスを二度起こさないための記録とゲート一覧。

## 2026-08-22: 旧価格送信 + デモ中間ページ

### 起きたこと

| # | 内容 | 影響 |
|---|---|---|
| 1 | v1.1（66,000円）テンプレが **main に未push** のまま Automation が送信 | 日南ほか3社に55,000円表記 |
| 2 | デモに **「← デモ案一覧」** と slug 直下の **選択ページ** が残存 | リンク先が中間画面経由に見える |

### 恒久対策（必須ゲート）

| 層 | スクリプト / ルール | いつ |
|---|---|---|
| **送信前** | `verify-ops-pack.mjs` → `verify-before-send.mjs` | 毎送信・Automation 直前 |
| **返信前** | `verify-inbox-reply.mjs` | checkout / followup を送る前 |
| **CI** | `.github/workflows/buyout-gates.yml` | main push / PR |
| **旧価格3社** | CSV `quoted_price=55000` + `demo_buyout_inbox.md` | 返信時66k決済禁止 |
| **公開** | `publish-prospect.mjs` が picker 削除 + index 非公開 | swap 後毎回 |

### Automation 手順（順番固定）

1. `git pull origin main`
2. テンプレ・デモを変えたら **先に commit & push**（送信より前）
3. `node buyout-ops/verify-ops-pack.mjs` → PASS
4. `node buyout-ops/verify-before-send.mjs --from-csv --company "…"` → PASS
5. 公開URLが **200** かつ picker なしを確認（V1/V7）
6. 送信 → CSV 更新 → push

**verify が FAIL なら送らない。** オーナー確認なし運用でもこのゲートは省略不可。

### チェック ID 早見

| ID | 防ぐミス |
|---|---|
| V6/O5 | 公開HTML・デモに旧価格 |
| V7/O4 | デモ案一覧・picker |
| V8/O2 | 初回メールテンプレ旧価格 |
| V9/O7 | queued が 66k 以外 |
| V10/O3 | 中間 index.html 残存 |
| O8 | GitHub main 上のテンプレが旧版 |
| I2 | 旧価格コホートへの66k checkout |
