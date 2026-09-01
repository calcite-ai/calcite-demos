# デモ買い取り — 全国ターゲット収集パイプライン

> 2026-08-23  
> **方針: 捏造しない。枯渇したら次の業種へ。**  
> 送信は既存の 9:00/10:00 Automation。本書は **リストを増やす** ところだけ。

---

## 1. 3層ファネル（ミス防止）

```
【発見】種URLを集める（人間 + 既存リスト）
    ↓
【夜間スキャン】prospect-scan-batch.mjs（機械のみ・送信なし）
    ↓
【朝レビュー】C0/C3 人手（5分/社）
    ↓
【Hunter】verify-hunter-g1 → デモ → queued
    ↓
【送信】verify-before-send V13/V15 → 当日枠（send-quota.csv）
```

| 層 | 誰 | 止めるミス |
|---|---|---|
| 夜間 | 機械 | モダンサイト（石川型）・メール推測・粗1点。**C1: 種が http でも https を試し、通れば SSL未整備と書かない**（`site-g1-eval` / 既存誤診は `prospect-rescan-https.mjs`） |
| 朝 | 人間 | 別公式（マキノ型）・スマホ実機 |
| Hunter | 機械+人 | blocklist・G1再確認 |
| 送信 | 機械 | デモ404・旧価格 |

**全自動で全国 Maps 巡回はやらない**（ToS・誤診・負荷）。  
**種URLの追加**だけ人間、**判定**は夜間バッチ。

---

## 2. 全国の見つけ方（工務店 Phase 1）

### 2-A. 種URLの集め方（週30分 × オーナー or エージェント）

| ソース | やり方 | 全国化 |
|---|---|---|
| Google Maps | 「工務店 + 県名」→ 公式URL・メール有無を目視 → `seeds/koumuten_urls.csv` に1行追加 | **47都道府県をローテ**（週1県、20社） |
| 既存 `sales_prospects.csv` | メール未公開でも URL あれば scan 対象 | `extract-seeds-from-prospects.mjs` |
| 紹介・口コミサイト | 掲載URLのみ（メールは scan 任せ） | エリア偏り注意 |
| 商工会・協会 | 会員一覧のリンク | 地方ほど粗が多い |
| **住活協 builderlist** | `fetch-jyukatsukyo-builderlist.mjs` または `koumuten_jyukatsukyo_pref_cache.csv` | 404時は cache CSV |

**47県ローテ例（2026-Q3）**

| 週 | 県 | 目標種URL |
|---|---|---|
| 1 | 北海道・青森・岩手 | 各15 |
| 2 | 宮城・秋田・山形・福島 | 各15 |
| … | （以降関東→中部→西日本） | |

1県20社 × 47 ≒ **940社/年**。1日1通なら **2〜3年分**の在庫。  
工務店で CANDIDATE が月5未満になったら **Phase 2（税理士等）** へ。

### 2-B. 夜間バッチ（PCスリープ禁止）

```bash
cd ~/claude/02_hp-sales/demos

# 1) 既存リストから種を更新
node buyout-ops/extract-seeds-from-prospects.mjs --merge

# 2) 寝る前（2秒間隔・800件≒27分/1000件は sleep 込みで数時間）
caffeinate -i node buyout-ops/prospect-scan-batch.mjs --sleep-ms 2000

# 短いテスト
node buyout-ops/prospect-scan-batch.mjs --limit 10 --sleep-ms 1500
```

出力: `buyout-ops/prospect_pipeline/scan_results.csv`

| status | 意味 | 次 |
|---|---|---|
| **CANDIDATE** | メールあり・粗2点以上・非モダン | 朝レビュー → prospects へ |
| G1_MODERN | 新しすぎ | 捨てる（捏造禁止） |
| G1_WEAK | 粗1点以下 | 捨てる |
| NO_EMAIL | フォームのみ | 電話トラック or スキップ |
| BLOCKLIST | 過去営業済 | 触らない |

**再開:** 同じコマンドで OK（スキャン済 URL はスキップ）。

**インサイド PoC（HP溢れ → 採用/AI/HP改善）:** スキャン後に `run-campaign-pipeline.mjs` または `enrich-scan-campaign.mjs` → `split-scan-tracks.mjs`。詳細は [`inside_sales_campaign_routing.md`](./inside_sales_campaign_routing.md)。

### 2-B2. CANDIDATE < 50 のとき — 商工会・公式リストで種＋メール補完

**50件ライン未満**かつ NO_EMAIL が多いとき:

1. **商工会議所 / 商工会** の会員一覧（建設・工務）から **公式HP URL** を拾う（メールは chamber ページに無いことが多い → 各社HPへ）
2. **自治体PDF**（例: 十和田市 耐震改修事業者リスト）の **HP + Eメール** は公式ソースとして `seeds/koumuten_official_*.csv` に追加
3. `node buyout-ops/merge-seed-files.mjs` → `prospect-scan-batch.mjs`
4. NO_EMAIL 残り: `node buyout-ops/prospect-rescan-no-email.mjs`（/company.html 等の深いパス）
5. FETCH_FAIL（index.html URL）: `node buyout-ops/prospect-rescan-fetch-fail.mjs`

**禁止:** `info@ドメイン` の推測。PDF・会社概要ページに載ったメールのみ。

### 2-C. 朝イチ（CANDIDATE だけ・1社5分）

1. `scan_results.csv` で `status=CANDIDATE` をフィルタ
2. **C0** 社名検索 → 別公式ないか
3. **C3** 390px 実機 or DevTools
4. `node buyout-ops/verify-hunter-g1.mjs --url <final_url>` → PASS
5. `sales_prospects.csv` に行追加（`HP状態`・`audit_draft` を転記）
6. 週の Hunter キューは `hunter-suggest.mjs` が拾う

---

## 3. 業種切り替え（枯渇したら次へ）

| 条件 | アクション |
|---|---|
| `hunter-suggest` が **2週連続** G1通過ゼロ | 県ローテ完了 or 工務店枯渇を確認 |
| CANDIDATE 在庫 **5社未満** | 次 vertical の seed 作成開始 |
| 税理士・葬儀テンプレ ready | `vertical-config.mjs` の `ACTIVE_VERTICAL` 変更 |

**禁止:** モダンサイトを無理やり queued にする。  
**許可:** 工務店を切り上げて `zeirishi` → `sougi` へ（同じパイプライン、seed ファイルだけ分ける）。

```
seeds/koumuten_urls.csv   → vertical=koumuten
seeds/zeirishi_urls.csv   → --vertical zeirishi（将来）
seeds/sougi_urls.csv      → --vertical sougi（将来）
```

---

## 4. 欠陥タイプでバッチ（学習用）

週ごとに **1欠陥タイプ** に寄せると返信分析が楽（Hunter §6）。

| 週 | スキャン後フィルタ | メール訴求 |
|---|---|---|
| A | `defects` に https | SSL・信頼 |
| B | viewport なし | スマホ |
| C | tel: なし | 問い合わせ導線 |

Maps で種を集めるときも同じ欠陥を意識すると効率よい。

---

## 5. ファイル一覧

| ファイル | 役割 |
|---|---|
| `seeds/koumuten_urls.csv` | 入力（company,url,prefecture,source） |
| `extract-seeds-from-prospects.mjs` | prospects → seeds 同期 |
| `prospect-scan-batch.mjs` | 夜間スキャン |
| `prospect-rescan-no-email.mjs` | NO_EMAIL 再取得（深い contact パス） |
| `prospect-rescan-fetch-fail.mjs` | FETCH_FAIL 再試行 |
| `merge-seed-files.mjs` | seeds/*.csv → koumuten_urls.csv |
| `fetch-jyukatsukyo-builderlist.mjs` | 住活協 builderlist から種URL（404時は pref_cache） |
| `seeds/koumuten_jyukatsukyo_pref_cache.csv` | 住活協キャッシュ（都道府県別・手動） |
| `seeds/koumuten_gpt_verified.csv` | GPT再検証済み（G1 PASS） |
| `prepare-review-sheet.mjs` | CANDIDATE → review_queue.csv |
| `prospect_pipeline/review_queue.csv` | 朝レビュー（owner_ok=y） |
| `site-g1-eval.mjs` | G1判定ロジック |
| `verify-hunter-g1.mjs` | queued 前ゲート |

---

## 6. 送信ペースとの関係（2026-09-01 更新 — buyout 1 + inside 1/日）

確認: `node buyout-ops/collection-status.mjs`

### 逆算の前提

| 項目 | 値 |
|---|---|
| 送信 | **buyout 1 + inside 1 / 日**（`send-quota.csv`） |
| 月間 | 約 **60通**（各30） |
| 在庫バッファ | **90日分** を目安に種URL・承認を管理 |

### 現状の結論（2026-09-01 時点）

| トラック | 在庫 | 収集 |
|---|---|---|
| **inside** | approved **〜174社**（約6ヶ月分） | **停止** — 新規 owner_ok 不要。S→A→B の送信消化優先 |
| **buyout** | CANDIDATE **61** は review 済。送信可能 **queued 1** | **新規種URLは buyout 用に継続**。ボトルネックは **9:00 デモAutomation**（approved 41 デモ未） |

**inside を増やし続けると承認だけ溜まり送信が追いつかない。** buyout は「リスト不足」より **9:00 デモAutomationが approved 41 を順次 queued 化** が先（手動週次制作ではない）。

### 週次オペレーション（最適）

| 優先 | 作業 | 目安 |
|---|---|---|
| 1 | **9:00 Cursor Automation** — `refill-queue-if-empty.mjs` exit 3 → 1社デモ→queued（**当日 buyout 残枠ぶん**） | **自動**（`demo_buyout_daily_schedule.md`） |
| 2 | **10:00 GitHub Actions** — buyout + inside 送信 | **自動** |
| 3 | **新種URL** — Maps 手動 / 住活協 / 公式PDF（メール欄あり） | 週 **25〜35 URL**（CANDIDATE率〜6% → buyout 月1〜2社 + inside 分岐） |
| 4 | **NO_EMAIL 再スキャン** — `prospect-rescan-no-email.mjs` | 週 **40件** バッチ（全338一括は不要） |
| 5 | **FETCH_FAIL 再試行** — `prospect-rescan-fetch-fail.mjs` | 週 **30件** |
| — | inside 新規承認 | **90日分を下回るまで不要** |

### 夜間バッチ（変更なし）

```bash
node buyout-ops/merge-seed-files.mjs
caffeinate -i node buyout-ops/prospect-scan-batch.mjs --sleep-ms 2000   # 新種がある週のみ
node buyout-ops/run-campaign-pipeline.mjs   # enrich + split（--scan は新種追加週）
```

**inside 承認:** `inside_sales_review_queue.csv` への bulk owner_ok は **pause**。返信・手動例外のみ。

### ソース優先度

| 優先 | ソース | 理由 |
|---|---|---|
| 高 | 手動 Maps / http_research | CANDIDATE 転換率高 |
| 高 | 住活協 builderlist（`jyukatsukyo_*`） | URL 公式・一定の粗 |
| 中 | 商工会・自治体PDF（Eメール欄） | NO_EMAIL 回避 |
| 低 | sahn / 大規模会員一覧のみ | NO_EMAIL 多（3%未満 CANDIDATE） |

### 旧メモ

- 収集: 週20〜50 CANDIDATE 想定は **buyout単独1/日** 時代の目安。dual-track では **inside 収集停止 + buyout 種25/週** に再配分。
- **在庫 sendable=0 でも OK。** 捏造より 0 の日を許容。

---

## 7. やらないこと

- Google Maps API の無許可スクレイピング
- `info@ドメイン` の機械生成
- G1_WEAK / G1_MODERN を queued にする
- 工務店枯渇時に別業種のサイトを koumuten 扱いする
