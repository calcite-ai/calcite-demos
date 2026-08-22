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
| **10:00** | Demo buyout daily send | approval_seq 順に1通送信 |

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
| **0** | sendable あり（queued+built） | **終了**（10:00 送信に任せる） |
| **3** | 承認済み・デモ未（`status=approved`） | 下記「Build 1社」を実施 |
| **2** | 承認キューなし・sendable=0 | **終了**（夜スキャン/朝承認待ち。**hunter-suggest しない**） |

### Build 1社（exit 3 のとき）

1. `node buyout-ops/next-approved.mjs` で **seq 最小** の1社を確認
2. [`demo_buyout_hunter.md`](./demo_buyout_hunter.md) G0〜G5 / C0〜C5
3. **`node buyout-ops/verify-hunter-g1.mjs --from-csv --company "…"` PASS**
4. 合格なら:
   - `swap-prospect.mjs` → `publish-prospect.mjs` → **buyout-prospects push**
   - `demo_buyout_leads.csv`: **`status=queued`**, `demo_url_a/b`, **`approval_seq` は維持**
5. `verify-before-send.mjs` PASS → **commit & push**（10:00前）

**1日1社まで。** 承認リスト外の `hunter-suggest` は使わない。

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

- `queue-status.mjs` → **approval_seq 最小** の sendable
- sendable=0 なら **送らない**
- verify PASS 後に初回メール 1通（**オーナー確認不要**）

---

## Cursor Automation プロンプト（9:00 用・コピペ）

```
git pull origin main
node buyout-ops/refill-queue-if-empty.mjs
終了コード 3 なら demo_buyout_owner_workflow.md §9:00: next-approved の1社をデモ制作→queued→push。
終了コード 0 または 2 なら何も送らず終了。
```

## Cursor Automation プロンプト（10:00 用）

```
git pull origin main
demo_buyout_autorun.md の手順どおり。sendable=0 なら送信しない。queued は approval_seq 最小から。
```

---

## 補足

- **paused 昇格**は承認キューが空のときのみ（レガシー）
- 税理士・葬儀（`zeirishi` / `sougi`）は **Phase2まで送信・昇格禁止**
- 9:00 でデモできても 10:00 前に verify PASS できなければ **その日は送らない**
