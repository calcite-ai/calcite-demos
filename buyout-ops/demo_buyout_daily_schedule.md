# デモ買い取り — 日次スケジュール（9:00 / 10:00 JST）

> 2026-08-23: **オーナー承認キュー**運用。[`demo_buyout_owner_workflow.md`](./demo_buyout_owner_workflow.md) が正本。

## 3段階の役割分担

| タイミング | 誰 | 役割 |
|---|---|---|
| **夜** | エージェント | 全国スキャン → `review_queue.csv` 生成 |
| **朝** | オーナー | `owner_ok=y` → `import-review-approvals`（**1回だけ**） |
| **9:00 / 10:00** | Automation | 承認リスト上からデモ→送信（**毎日自動**） |

---

## 2本の Automation

| 時刻 (JST) | 名前（案） | 役割 |
|---|---|---|
| **9:00** | Demo buyout queue refill | 承認キュー先頭のデモ制作 |
| **10:00** | Demo buyout daily send | approval_seq 順に **当日残枠** 送信（`send-quota.csv`） |
| **15:00** | 同上（catch-up） | 残枠があれば再実行。0なら即 skip |

### Automation UI 必須設定（docs だけでは足りない）

2026-08-25/26 連続事故: クラウド側が **Draft PR** を開き、Pages が 404 のまま 10:00 が空振り。

- 9:00 ID: `3e92e8d0-9e28-11f1-a7d1-d6b4613131ce`
- UI で **Open as pull request / Draft PR をオフ**し、**main へ直接 push** する運用にする
- プロンプト末尾にも「PR 作成 = 失敗。必ず main push 後に verify-before-send PASS」を残す
- repo の `demo_buyout_daily_schedule.md` を直しただけでは再発する（UI 側の既定が勝つ）

---

## 9:00 — デモ制作（承認キュー）

### エージェント手順

0. `git pull origin main`
1. 実行:

```bash
cd demos   # calcite-demos リポジトリ root
node buyout-ops/refill-queue-if-empty.mjs
```

2. 終了コードで分岐:

| exit | 意味 | やること |
|---|---|---|
| **0** | 残枠ぶんの sendable あり、または今日の枠満了 | **終了**（10:00 送信に任せる / 枠満了） |
| **3** | 残枠あり・デモ未（`status=approved`） | 下記「Build 1社」を実施し、**refill を再実行**（残枠が埋まるまで） |
| **2** | 承認キューなし・sendable 不足 | **終了**（夜スキャン/朝承認待ち。**hunter-suggest しない**） |

### Build 1社（exit 3 のとき）

1. `node buyout-ops/next-approved.mjs` で **seq 最小** の1社を確認
2. [`demo_buyout_hunter.md`](./demo_buyout_hunter.md) G0〜G5 / C0〜C5
3. **`node buyout-ops/verify-hunter-g1.mjs --from-csv --company "…"` PASS**
4. 合格なら:
   - `swap-prospect.mjs` → `publish-prospect.mjs` → **buyout-prospects push**
   - `demo_buyout_leads.csv`: **`status=queued`**, `demo_url_a/b`, **`approval_seq` は維持**
5. `verify-before-send.mjs` PASS → **commit & push**（10:00前）

**1朝あたり、当日残枠が埋まるまで。** 承認リスト外の `hunter-suggest` は使わない。

### 機械補助コマンド

```bash
node buyout-ops/queue-status.mjs --json       # sendable / approved_waiting
node buyout-ops/next-approved.mjs             # 次にデモを作る1社
node buyout-ops/prepare-review-sheet.mjs      # 朝レビュー用（夜スキャン後）
node buyout-ops/import-review-approvals.mjs   # オーナー承認取込
```

---

## 10:00 — 送信

[`demo_buyout_autorun.md`](./demo_buyout_autorun.md) どおり。

- `queue-status.mjs` → **remaining_today と next_send**
- remaining_today=0 なら **送らない**
- verify PASS 後に初回メールを **残枠ぶん**（**オーナー確認不要**）

---

## Cursor Automation プロンプト（9:00 用）

**正本は [`prompts/demo-build-0900.md`](./prompts/demo-build-0900.md)。**
ここにコピーを置かない。

2026-09-05 に、Automation に貼られていた実物がこの doc から4行ズレていた
（先方HPを読む指示・FACT照合・`skin_pair`・`demo_url_b` が欠落）。
結果、ダミーの営業時間が実在企業名のページで公開された。
2箇所に本文を持つとまた同じことが起きるので、貼り付け元は1つに固定する。

貼り直すときは正本ファイルのコードブロックをそのまま使う。

## 10:00 の送信について

**送信は GitHub Actions [`buyout-daily-send.yml`](../.github/workflows/buyout-daily-send.yml) が実行する。
Cursor Automation の 10:00 送信は 2026-08-26 に削除済み。**

ここに手動送信の手順を置かない。Actions と並行して人が送ると二重送信になる
（2026-09-04 佐藤工務店・2026-09-03 吉原建設は別原因だが、同じ結果を招いた）。

### 実行タイミング

cron は UTC。本命 01:00 UTC（10:00 JST）で、遅延・スキップが多いため予備が4本ある。

| cron (UTC) | JST | 位置づけ |
|---|---|---|
| `0 1` | 10:00 | 本命 |
| `0 2` / `0 3` / `0 4` | 11:00 / 12:00 / 13:00 | 回収 |
| `0 6` | 15:00 | 午後 catch-up |

加えて `buyout-ops/demo_buyout_leads.csv` と `buyout-prospects/**` への
push でも発火する（cron が飛んだ日の穴埋め）。
**枠がリセットされた後に push すると、その時刻に送信される。**
深夜や早朝に push しないこと（2026-09-06 は 14:11 JST に送信された）。

### 手で送りたいとき

手順を再現せず、**workflow_dispatch を使う**。

```bash
gh workflow run buyout-daily-send.yml                      # 本番
gh workflow run buyout-daily-send.yml -f dry_run=true      # 送らず確認
```

ゲート・枠・レシート記録がすべて同じ経路を通るので、二重送信も枠超過も起きない。

### 送信されない理由を調べる

```bash
node buyout-ops/queue-status.mjs        # sendable / remaining_today
node buyout-ops/verify-before-send.mjs --from-csv --company "<社名>"
gh run list --workflow=buyout-daily-send.yml --limit 5
```

`RESULT skip — buyout_remaining=0` は正常（当日枠を使い切っている）。

## 補足

- **paused 昇格**は承認キューが空のときのみ（レガシー）
- 税理士・葬儀（`zeirishi` / `sougi`）は **Phase2まで送信・昇格禁止**
- 9:00 でデモできても 10:00 前に verify PASS できなければ **その日は送らない**
