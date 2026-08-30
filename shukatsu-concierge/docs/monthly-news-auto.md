# ニュース月次自動公開

カテゴリ「ニュース」のコラムだけ、毎月1回・情報収集して自動公開する。

## 方針

| 種類 | 生成 | 公開 |
|---|---|---|
| 通常コラム・解決事例 | AI可 | **人が承認してから** |
| **ニュース** | コラムと同じルール（Web検索・SEO/GEO・断定抑制） | **自動 publish** |

AI再チェックが `critical` のときだけ下書き保存に留め、公開しない。

## スケジュール

- **毎月1日 10:00**（WordPress サイトタイムゾーン。本番は Asia/Tokyo 想定）
- 実装: プラグイン `shukatsu-content` の単発 WP-Cron（実行後に翌月を再スケジュール）
- 時刻の確実性のため、GitHub Actions からも同日に REST を叩く（推奨）

## 生成内容

- テーマツリーの `news`（ガイドライン / 調査 / 法改正を月でローテ）
- Claude + `web_search` で当月の公的情報・報道を収集
- `/ops/` コラム下書きと同じ構成・ファクトチェック二段
- カテゴリ term「ニュース」（ID 14）を付与
- 冒頭に「自動整理したニュース解説」の注記

## 外部トリガ（GitHub Actions）

1. 管理画面「設定 → 終活コンテンツ」でトークンを確認
2. Repository Secrets に設定:
   - `SHUKATSU_NEWS_CRON_TOKEN` … 画面のトークン
   - （任意）`SHUKATSU_NEWS_CRON_URL` … 既定は `https://shukatsu.or.jp/wp-json/shukatsu/v1/monthly-news/run`
3. ワークフロー: `.github/workflows/publish-monthly-news.yml`
   - cron: `0 1 1 * *`（UTC）＝ JST 10:00
   - `workflow_dispatch` でも手動実行可

```bash
curl -X POST \
  -H "X-Shukatsu-Cron-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  "https://shukatsu.or.jp/wp-json/shukatsu/v1/monthly-news/run"
```

同月2回目はスキップ。`?force=1` または JSON `{"force":true}` で強制。

## 管理画面

- 「今すぐ1本生成・公開（テスト）」
- 「強制再実行（同月でも可）」
- 次回スケジュール・直近ログ表示

## 前提

- `SHUKATSU_ANTHROPIC_API_KEY` が本番 `wp-config.php` に入っていること
- プラグイン version **0.7.12+**

## 関連

- [seo-geo-writing.md](./seo-geo-writing.md)
- [column-draft-pipeline.md](./column-draft-pipeline.md)（通常コラムは draft のまま）
