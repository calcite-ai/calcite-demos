# デモ買い取り — 日次スケジュール（9:00 / 10:00 JST）

> 2026-08-22 追加: キュー空の日に送信が止まらないよう **9:00 補充** を分離。

## 2本の Automation

| 時刻 (JST) | 名前（案） | 役割 |
|---|---|---|
| **9:00** | Demo buyout queue refill | 送付先確認 → 0なら補充 |
| **10:00** | Demo buyout daily send | verify → 1通送信 |

---

## 9:00 — キュー補充（Hunter）

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
| **0** | `queued`/`built` が既にある、または paused 昇格済 | **終了**（10:00 送信に任せる） |
| **3** | 候補ゼロまで補充できず Hunter 必要 | 下記「Hunter 1社」を実施 |

### Hunter 1社（exit 3 のときだけ）

1. `hunter-suggest.mjs` の **先頭1社** を対象に [`demo_buyout_hunter.md`](./demo_buyout_hunter.md) の G0〜G5 / C0〜C5 を実施
2. `node ../tools/site-audit.mjs <url>`（`02_hp-sales/tools/`）で C1/C2 補助
3. 合格なら:
   - `swap-prospect.mjs` → `publish-prospect.mjs` → **buyout-prospects push**
   - `demo_buyout_leads.csv` に行追加 or 更新、`status=queued`, `quoted_price=66000`
   - `demo_url_a/b` を Pages URL で埋める
4. `node buyout-ops/verify-before-send.mjs --from-csv --company "…"` が PASS するまで
5. **commit & push**（10:00 前に main 反映）

**1日1社まで。** 週7送信上限（土日含む）は 10:00 側で守る。

### 機械補助コマンド

```bash
node buyout-ops/queue-status.mjs              # sendable 件数
node buyout-ops/promote-paused.mjs            # デモ済 paused の確認
node buyout-ops/promote-paused.mjs --apply    # 1件 queued へ
node buyout-ops/hunter-suggest.mjs --limit 5  # 新規候補
```

---

## 10:00 — 送信

[`demo_buyout_autorun.md`](./demo_buyout_autorun.md) どおり。

- `queue-status.mjs` で sendable=0 なら **送らない**（9:00 補充失敗の日）
- verify PASS 後に初回メール 1通

---

## Cursor Automation プロンプト（9:00 用・コピペ）

```
git pull origin main
node buyout-ops/refill-queue-if-empty.mjs
終了コード 3 なら demo_buyout_daily_schedule.md の Hunter 1社を実施し、queued まで commit & push。
終了コード 0 なら何も送らず終了。
```

## Cursor Automation プロンプト（10:00 用）

```
git pull origin main
demo_buyout_autorun.md の手順どおり。sendable=0 なら送信しない。
```

---

## 補足

- **paused 昇格**は `vertical=koumuten`・デモURL済み・`quoted_price=66000`・C0不合格メモなしのみ
- 税理士・葬儀（`zeirishi` / `sougi`）は **Phase2まで送信・昇格禁止**
- 9:00 で Hunter しても 10:00 前に verify PASS できなければ **その日は送らない**（無理送付防止）
