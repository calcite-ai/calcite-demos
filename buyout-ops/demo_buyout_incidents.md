# デモ買い取り — 再発防止（インシデント記録）

> 同種ミスを二度起こさないための記録とゲート一覧。

## 2026-08-31: 10:00 Actions が未実行 — 営業メール0通

### 起きたこと

| # | 内容 | 影響 |
|---|---|---|
| 1 | 8/31 10:00 JST 時点で `Buyout daily send` の schedule 実行が **0件**（GitHub API 確認） | 当日枠2通が未送信 |
| 2 | 過去4日の schedule も **01:00 UTC（10:00 JST）で一度も成功していない**。05:57〜12:18 UTC の1回/日のみ | 実質「午後 slot のみ」依存 |
| 3 | `origin/main` には田代・髙須が **queued + デモURLあり**（sendable=2）だったが送信 workflow が走らなかった | git 遅れではなく **未送信** |
| 4 | 8/30 夜〜8/31 未明に `buyout-daily-send.yml` を複数回変更（2通/日・SendGrid 配線） | public repo の schedule 不安定化要因の一つ |

### 根本原因

- **GitHub Actions schedule の信頼性**（public repo で 01:00 UTC がスキップされがち）
- **9:00 デモ push → 10:00 送信** の連携が schedule のみで、push トリガーがなかった

### 恒久対策

| 層 | 内容 |
|---|---|
| **workflow** | `buyout-daily-send.yml` に **push trigger**（`demo_buyout_leads.csv` / `buyout-prospects/**`）＋ 02–04 UTC バックアップ cron |
| **冪等** | `remaining_today=0` / sendable=0 なら skip（push 連鎖でも二重送信しない） |
| **運用** | 取りこぼし時は `workflow_dispatch` で手動実行 |

---

## 2026-08-25〜26: 9:00 が Draft PR で止まり 10:00 が送れない（連続）

### 起きたこと

| # | 日付 | 内容 | 影響 |
|---|---|---|---|
| 1 | 8/25 | 9:00 がビルドテクトを制作したが [PR #6](https://github.com/calcite-ai/calcite-demos/pull/6) で停止（main 未反映） | Pages 404 → 10:00 送信不可。夜に手動マージ＋送信 |
| 2 | 8/26 | 同経路で基工務店を [PR #7](https://github.com/calcite-ai/calcite-demos/pull/7)（Draft）に作成。本文に「マージして」と書きつつ PR のまま終了 | 再び `sendable=0`。夕方にマージ後も `user-gmail` `invalid_grant` で自動送信不可 |
| 3 | 8/25 夜 | docs に「Draft PR 禁止・main 直 push」を追記（`ed9e5f2`） | **リポジトリ内プロンプトだけでは足りない**。Automation UI / クラウド既定が PR 作成を優先 |

### 根本原因

- 10:00 の不具合ではなく、**9:00 の公開経路が `main` でない**こと
- Cursor Automation は変更を **Draft PR にする既定**があり、repo の禁止文より強い

### 恒久対策

| 層 | 内容 |
|---|---|
| **Automation UI** | 9:00「Demo buyout queue refill」(`3e92e8d0-9e28-11f1-a7d1-d6b4613131ce`) を開き、**PR を作らず main へ直接 commit/push** する設定・プロンプトにする（docs 更新だけでは再発する） |
| **エージェント** | exit 3 のあと `verify-before-send` が Pages 200 になるまで終了しない。PR URL を出したら失敗扱い |
| **10:00** | `sendable=0` のとき「9:00 が main 未反映かも」を notes / ログに残す |
| **送信** | buyout は `user-gmail` `send_email` + text/plain。`invalid_grant` なら送らず再認証（plugin-gmail で初回を送らない） |

---

## 2026-08-25: plugin-gmail 送信で再び「リダイレクトの警告」

### 起きたこと

| # | 内容 | 影響 |
|---|---|---|
| 1 | ビルドテクト初回を `plugin-gmail-gmail` の `send_message` で送信 | MIME が `multipart/alternative`（text/html 付き）になった |
| 2 | 送信時点の text/plain 本文に既に `https://www.google.com/url?q=…` が入っていた | クリックで「リダイレクトの警告」 |

### 恒久対策

| 層 | 内容 |
|---|---|
| **送信経路** | buyout 初回は **`user-gmail` の `send_email` + `mimeType=text/plain` のみ**（`htmlBody` 禁止） |
| **禁止** | `plugin-gmail-gmail` / `send_message` で初回営業を送らない（URLラップする） |
| **確認** | 送信直後に RAW MIME を見て `google.com/url` と `text/html` が無いこと |

---

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
