# デモ買い取り — 再発防止（インシデント記録）

> 同種ミスを二度起こさないための記録とゲート一覧。

## 2026-08-24: メールリンクが「リダイレクトの警告」経由

### 起きたこと

| # | 内容 | 影響 |
|---|---|---|
| 1 | 送信本文に `https://www.google.com/url?q=…` が入った／Gmail閲覧でラップ | クリックすると「リダイレクトの警告」→もう一回タップ |
| 2 | 公式URLが `https://calcite-ai.jp`（wwwなし） | WordPressが `https://www.calcite-ai.jp/` へ301 → 警告が出やすい |
| 3 | デモURL末尾スラッシュ欠落 | GitHub Pages が 301 → 同上 |

### 恒久対策

| 層 | 内容 |
|---|---|
| **テンプレ** | `Web：https://www.calcite-ai.jp/`（apex禁止） |
| **送信** | `render-outreach-email.mjs` → **text/plain のみ**（htmlBody禁止） |
| **禁止** | 本文に `google.com/url` を貼らない（Gmail APIの取得結果をコピペしない） |
| **ゲート** | O12 / V8 / V14（apex・ラップURL・デモURLの301） |

---

## 2026-08-23: 新しいサイトへの buyout キュー投入（石川工務店）

### 起きたこと

| # | 内容 | 影響 |
|---|---|---|
| 1 | [waraku-i.com](https://www.waraku-i.com/) を Hunter 対象に **queued** | HTTPS・viewport・tel:・2025更新 — buyout 訴求が刺さらない |
| 2 | G1 は docs 上必須だが **スクリプト未実装** | verify(V1〜V12)はデモ側のみ → PASS |
| 3 | `sendable=1` 優先で弱い粗を後付け | オーナー指摘まで気づかず |

### 恒久対策（必須ゲート）

| 層 | スクリプト | いつ |
|---|---|---|
| **Hunter前** | `verify-hunter-g1.mjs --prospect-company` | suggest 候補の queued 前 |
| **suggest** | `hunter-suggest.mjs`（G1 オン） | モダンサイトを候補から除外 |
| **昇格** | `promote-paused.mjs` 内 G1 | paused→queued |
| **送信前** | `verify-before-send.mjs` **V13** | サイト再取得 + audit_notes |
| **CI** | `verify-hunter-g1.mjs --from-csv --queued` | main に queued がある push |

### モダン除外ルール（機械）

`site-g1-eval.mjs`: **HTTPS + viewport + tel: + HTML内更新年≥2023** → G1 FAIL（Hunter§5）

---

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
4. `node buyout-ops/verify-hunter-g1.mjs --from-csv --company "…"` → PASS（G1）
5. `node buyout-ops/verify-before-send.mjs --from-csv --company "…"` → PASS
6. 公開URLが **200** かつ picker なしを確認（V1/V7）
7. 送信 → CSV 更新 → push

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
| V13 | G1 モダンサイト除外 / audit 粗不足 |
