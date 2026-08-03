# REST 下書き仕様（コラム・事例）

ログイン後、Author専用ユーザーのアプリケーションパスワードで実行する。  
エンドポイントのベースは現行構成どおり `https://shukatsu.or.jp/wp-json/`（`siteurl` は `/wp`）。

認証:

```http
Authorization: Basic base64(username:application_password)
Content-Type: application/json
```

---

## 1. コラム下書き作成

`POST /wp/v2/shukatsu_column`

```json
{
  "title": "記事タイトル",
  "status": "draft",
  "content": "<!-- wp:paragraph --><p>本文…</p><!-- /wp:paragraph -->",
  "excerpt": "一覧用の短い要約",
  "column_category": [12],
  "acf": {
    "meta_description": "検索用説明文（80〜120字）",
    "source_url": "https://www.example.go.jp/...",
    "ai_generated": true,
    "needs_review": true
  }
}
```

補足:

- `column_category` はタームID配列（初回は管理画面でID確認、または `GET /wp/v2/column_category`）
- ACFをRESTに出すには、ACF側で「REST APIで表示」ON、または `acf-to-rest-api` 等。フィールド名で送れない環境では `meta` + `register_meta` に切り替える
- **必ず `status: draft`**。自動 `publish` は禁止

成功時: `201` + 投稿オブジェクト。`id` を通知文に載せる。

---

## 2. 事例下書き作成（Intake投入後）

担当者がACFを埋めたあと、Webhook／手動スクリプトで本文を生成して更新する想定。

### 2a. 空の下書きを先に作る場合

`POST /wp/v2/shukatsu_case`

```json
{
  "title": "（仮）救急搬送後の身元保証｜病院MSW連携",
  "status": "draft",
  "content": "",
  "acf": {
    "case_audience": "病院MSW",
    "case_age_band": "80代",
    "case_family": "配偶者あり",
    "case_period": "1ヶ月以内",
    "case_actions": ["身元保証契約締結", "緊急連絡先対応"],
    "case_result": "解決・契約継続中",
    "case_background": "救急入院後、保証人が見つからず退院調整が止まっていた。",
    "case_point_note": "入院中の保証と退院後の受け皿を並行して整理した。",
    "case_anonymized": true,
    "ai_generated": false,
    "needs_review": true,
    "meta_description": ""
  }
}
```

カテゴリ（複数）:

```json
"case_category": [3, 5]
```

（タームID。ACFの taxonomy フィールドが `save_terms` している場合は、ターム指定だけでも可）

### 2b. AI本文を書き戻す

`POST /wp/v2/shukatsu_case/{id}`  ※WP RESTは更新も POST 可（または `PUT`/`PATCH`）

```json
{
  "content": "<p><strong>冒頭結論…</strong></p><h2>この事例で分かること</h2>…",
  "status": "draft",
  "acf": {
    "ai_generated": true,
    "needs_review": true,
    "meta_description": "生成した要約…"
  }
}
```

本文の推奨見出し（デモ／設計どおり）:

1. 冒頭結論  
2. この事例で分かること  
3. 相談内容  
4. 課題  
5. 対応内容  
6. 結果  
7. ポイント  

---

## 3. トピックス（人が手入力。APIは任意）

`POST /wp/v2/shukatsu_topic`

```json
{
  "title": "羽鳥慎一モーニングショーにて紹介されました",
  "status": "publish",
  "acf": {
    "topic_date": "2026-06-19",
    "topic_link_type": "none",
    "topic_pin": false
  }
}
```

通常運用は管理画面のみで十分。

---

## 4. 一覧・デバッグ

| 目的 | メソッド |
|---|---|
| コラム下書き一覧 | `GET /wp/v2/shukatsu_column?status=draft` |
| 事例下書き一覧 | `GET /wp/v2/shukatsu_case?status=draft` |
| 要確認だけ（ACFメタクエリは環境依存） | 管理画面の「要確認」列を優先 |
| カテゴリID確認 | `GET /wp/v2/column_category` / `GET /wp/v2/case_category` |

---

## 5. 通知（実装メモ）

下書き作成成功後:

1. Slack Incoming Webhook またはメール  
2. 文言例: `コラム下書き #123 を作成しました。確認URL: https://shukatsu.or.jp/wp/wp-admin/post.php?post=123&action=edit`

---

## 6. セキュリティ

- アプリパスワードは Author（または下書き作成のみの専用ユーザー）  
- リポジトリやチャットにパスワードを残さない  
- GitHub Actions では Repository Secret に保存  
- 本番DBへの破壊的変更はステージングで先に検証  

---

## 7. Astroデモ脚本との関係

現行 `npm run generate:drafts` は Markdown 出力。  
本番移行時は、同じ生成ロジックの出力先を本仕様の REST に切り替える。
