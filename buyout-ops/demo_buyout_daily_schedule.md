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

## Cursor Automation プロンプト（9:00 用・コピペ）

```
git pull origin main

cd buyout-ops がある calcite-demos リポジトリ root で作業する。
正本: buyout-ops/demo_buyout_daily_schedule.md
通数: buyout-ops/send-quota.csv（当日残枠ぶんだけデモを作る）
承認キュー: buyout-ops/demo_buyout_owner_workflow.md

残枠が埋まるまで繰り返す:

1) node buyout-ops/refill-queue-if-empty.mjs を実行

2) 終了コード 0 → ループ終了（10:00 の送信 Automation に任せる／今日の枠満了）

3) 終了コード 2 → ループ終了（承認キューなし・待機。hunter-suggest しない）

4) 終了コード 3 → 承認キュー先頭1社だけデモ制作（工務店のみ）:
   - node buyout-ops/next-approved.mjs で社名確認
   - buyout-ops/demo_buyout_hunter.md の G0〜G5 / C0〜C5
   - node buyout-ops/verify-hunter-g1.mjs --from-csv --company "<社名>" PASS
   - 税理士・葬儀は絶対に queued にしない（vertical=koumuten のみ）
   - 承認リスト外の hunter-suggest は使わない
   - buyout-template/designs/swap-prospect.mjs → publish-prospect.mjs → buyout-prospects を **main へ直接 push**（Draft PR 禁止。Pages は main 反映後しか 200 にならない）
   - demo_buyout_leads.csv: status=queued, quoted_price=66000, vertical=koumuten, demo_url_a/b 記入（approval_seq は変えない）
   - node buyout-ops/verify-before-send.mjs --from-csv --company "<社名>" が PASS まで（Pages 200 必須）
   - **同じコミットで** leads CSV も main へ push（10:00 前）
   - 再度 1) に戻る（sendable が残枠以上になるまで）

禁止:
- 66k 以外の価格でメール送信
- quoted_price=55000 の3社への決済メール
- verify FAIL のまま送付先を queued のまま放置せず、失敗理由を notes に残す
- オーナー未承認の hunter-suggest で queued を増やさない
- **PR / Draft PR で止めること**（必ず main push。今日の事故: PR#6 未マージで Pages 404 → 送信不可）
```

## Cursor Automation プロンプト（10:00 用・コピペ）

```
git pull origin main

cd buyout-ops がある calcite-demos リポジトリ root で作業する。
正本: buyout-ops/demo_buyout_autorun.md
通数: buyout-ops/send-quota.csv
ゲート: buyout-ops/demo_buyout_pre_send_checklist.md

残枠が0になるまで、1社ずつ送る:

1) node buyout-ops/queue-status.mjs
   - remaining_today=0 または sendable=0 なら送信せず終了

2) next_send（approval_seq 最小）の1社を取る

3) Gmail で to:{email} from:me を再確認（過去送信があれば paused）

4) 送信直前に G1 の C0〜C2（正規サイト・HTTPS最終到達・tel:）を再確認。
   課題は audit_notes からのみ（demo_buyout_audit_checklist.md / demo_buyout_hunter.md）

5) デモ未公開なら swap-prospect.mjs → publish-prospect.mjs → buyout-prospects のみ push

6) 公開URLが HTTP 200 になるまで送らない

7) 送信前ゲート（順番固定・どれか FAIL なら送らない）:
   node buyout-ops/verify-ops-pack.mjs
   node buyout-ops/verify-hunter-g1.mjs --from-csv --company "<社名>"
   node buyout-ops/verify-before-send.mjs --from-csv --company "<社名>"

8) node buyout-ops/render-outreach-email.mjs --company "<社名>" で本文生成し、
   その text/plain をそのまま送信（オーナー確認不要）。From: hello@calcite-ai.jp
   - htmlBody は渡さない（Gmail の google.com/url でリダイレクト警告になる）
   - デモURLは CSV の demo_url_a/b と同一（末尾 / 必須。google.com/url を貼らない）
   - 公式サイトは https://www.calcite-ai.jp/（apex 禁止）
   - 本文に 66,000円 があることを1行確認

9) demo_buyout_leads.csv を status=sent に更新。notes に「初回送信済 YYYY-MM-DD」と Gmail message id。
   commit & push

10) node buyout-ops/send-quota.mjs で remaining を確認。
    remaining>0 かつ sendable>0 なら 1) に戻る。remaining=0 で今日は終了。

禁止:
- 同日に残枠を超えて送る
- 66k 以外の価格で初回メール送信
- quoted_price=55000 の3社（新見・福澤・日南）への 66k 決済メール
- 税理士・葬儀（vertical が koumuten 以外）を送る
- prior_outreach_blocklist.csv 掲載先への再送
- verify FAIL のまま送る
- htmlBody / google.com/url ラップ
```

---

## 補足

- **paused 昇格**は承認キューが空のときのみ（レガシー）
- 税理士・葬儀（`zeirishi` / `sougi`）は **Phase2まで送信・昇格禁止**
- 9:00 でデモできても 10:00 前に verify PASS できなければ **その日は送らない**
