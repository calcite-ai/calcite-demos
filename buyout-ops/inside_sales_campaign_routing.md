# インサイドセールス — 商材振り分け（PoC）

> 2026-08-31  
> HP買い取り（66k）と **別トラック**。送信は人間承認必須。

## 流れ

```
種URL → prospect-scan-batch.mjs
     → enrich-scan-campaign.mjs（inside候補のみHTML深掘り）
     → split-scan-tracks.mjs
```

| 出力 | 用途 |
|---|---|
| `prospect_pipeline/review_queue.csv` | HP買い取り（CANDIDATE） |
| `prospect_pipeline/inside_sales_review_queue.csv` | インサイド PoC レビュー |
| `inside_sales_poc_leads.csv` | inside 候補プール |
| `prospect_pipeline/campaign_scores.csv` | 全社スコア正本 |

## トラック分け（第1段）

| scan status | トラック |
|---|---|
| CANDIDATE + 有効メール | **buyout** |
| G1_MODERN / G1_WEAK + 有効メール | **inside** |
| NO_EMAIL / BLOCKLIST / FETCH_FAIL | skip |

## 商材スコア（第2段・insideのみ）

ルール実装: `campaign-score.mjs`  
閾値: **各3点以上** で推奨候補。同点優先 **recruit > ai_ops > hp_improve**。

| 商材 | 主な信号 |
|---|---|
| hp_improve | SSL/viewport/tel/更新停止、ワンページ、http混在、テンプレ残骸、英語メニュー |
| recruit | 採用URL、採用キーワード、古い採用ページ |
| ai_ops | G1_MODERN、FAX/PDF、見積フォーム（hp<3 のとき） |

**hp_improve の訴求軸（2026-09-01〜）:** HTTPS は整っていても、発注者・協力会社がスマホで短時間見たときの **信頼設計**（tel:・更新感・情報の整理）。66k buyout デモは出さない。

## 朝の操作

```bash
cd demos
node buyout-ops/run-campaign-pipeline.mjs          # enrich + split のみ
node buyout-ops/run-campaign-pipeline.mjs --scan   # 未スキャン + 上記
```

### インサイド承認

1. `inside_sales_review_queue.csv` を開く
2. `recommended_campaign` を確認（必要なら `owner_campaign` で変更: `hp_improve` / `recruit` / `ai_ops`）
3. 送ってよい行に `owner_ok=y`
4. `node buyout-ops/import-inside-approvals.mjs --dry-run`
5. `node buyout-ops/import-inside-approvals.mjs`

## 禁止

- 推測メール（`info@ドメイン` 等）
- buyout と inside を同一社・同日に送る
- owner_ok なしの自動送信（PoC）
- **送信済み（`sent` / `opt_out` / `paused` / `sent_at` / notes の「初回送信」）を `approved` に戻して再送すること**

## 再送防止（2026-09-03〜）

| 層 | ガード |
|---|---|
| `split-scan-tracks.mjs` | `sent_at` 保持。terminal status を demote しない。スキャン落ちの送信済みを orphan 保存 |
| `import-inside-approvals.mjs` | 既送信・opt_out・paused は `approved` に上書きしない |
| `send-inside-smtp.mjs` | 既送信証拠があれば送信拒否 |
| `send-quota.mjs` | 当日枠は notes/`sent_at` の日付でカウント（status が壊れても枠は消費済み） |
| `inbox-process.mjs` | inside 返信も照合。配信停止 → `opt_out` + blocklist |
| `verify-ops-pack.mjs` O18 | `approved` なのに送信済み証拠がある行を FAIL |

## buyout との関係

- `demo_buyout_leads.csv` は **buyout 専用**（変更なし）
- inside PoC は `inside_sales_poc_leads.csv` で分離

## 送信（2026-09-01〜）

| 項目 | 内容 |
|---|---|
| 枠 | `send-quota.csv` — **buyout 1 + inside 1 / 日** |
| 自動送信 | GitHub Actions `buyout-daily-send` → `daily-send-one.mjs` + `daily-send-inside-one.mjs` |
| 順序 | **send_tier**（S→A→月木B）のあと `queue_seq=` 昇順 |
| 文面 | `render-inside-email.mjs` — recruit / ai_ops / **hp_improve** テンプレ（`templates/email_inside_*`） |
| 確認 | `node buyout-ops/inside-queue-status.mjs` |

```bash
node buyout-ops/inside-queue-status.mjs
node buyout-ops/render-inside-email.mjs --company "矢島工務店"
node buyout-ops/daily-send-inside-one.mjs --dry-run
```

### hp_improve 初回メールの型

- 件名: 「実績の見せ方について」
- HTTPS は **問題ない** と明記してから、発注者目線の観察3点
- CTA: 「会社概要の見せ方」と返信（デモURL・66k・DX は出さない）

### 初回メールの構成（2026-09-03 改訂）

所感共有 → 任意の提案＋効果。了承前の工程表・断定は避ける。具体策は `inside-fix-ideas.mjs` が `campaign_evidence` から生成。

| ブロック | 内容 |
|---|---|
| 観察 | サイトの事実ベースの所感（断定しすぎない） |
| 免責 | 公開ページ範囲・現場と相違があれば謝罪 |
| **もし提案させていただけるとしたら** | 提案＋効果（最大3） |
| クロージング | 全面作り直し前提にしない／返信がなければ進めない |

返信キーワード: recruit=`採用ページのイメージ` / ai_ops=`問い合わせ後の整理` / hp_improve=`会社概要の見せ方`

**運用注意:** 返信があったら「改善イメージ1つ」の送付が約束どおり必要（S tier 優先で人手対応）。

## 送信ティア（send_tier）

刺さりやすさで送信順を制御。実装: `send-tier.mjs` / `apply-send-tier.mjs`

| tier | 意味 | 送信枠 |
|---|---|---|
| **S** | 痛みが具体（採用URL+更新古い、FAX+フォーム等） | 毎日枠で最優先 |
| **A** | 通常の recruit / ai_ops | S がいなければ毎日枠 |
| **B** | hp_improve 等（信頼設計の軽い提案） | **月・木のみ**、**週2通まで** |
| hold | skip / pool_skip | 送らない |

### 日次の選び方

1. `approved` かつ有効メール・blocklist 外
2. **S が1件でもあれば S のみ**（queue_seq 昇順）
3. S がなければ **A**（queue_seq 昇順）
4. S/A がなければ、今日が月・木かつ週の B 枠が残っていれば **B**

```bash
node buyout-ops/apply-send-tier.mjs          # review + poc に tier 付与
node buyout-ops/inside-queue-status.mjs      # 今日の next と tier 内訳
```

手動上書き: `inside_sales_review_queue.csv` または `inside_sales_poc_leads.csv` の `send_tier` 列に `S` / `A` / `B` / `hold` を直接書ける（再実行時も尊重）。

### リスト収集（2026-09-01）

**approved が 90日分（≈90社）ある間は inside の新規承認・種URL収集を止める。** 現状 174社 ≒ 6ヶ月分 → **収集 pause**。

buyout 側の種URL・CANDIDATE は継続（`demo_buyout_prospect_pipeline.md` §6）。在庫確認: `node buyout-ops/collection-status.mjs`
