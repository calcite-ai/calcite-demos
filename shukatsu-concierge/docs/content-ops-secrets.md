# コンテンツ半自動 — Secrets 方針

本番の Anthropic / WordPress Application Password を **公開リポ `calcite-ai/calcite-demos` に置かない**。

## 置き場所

| 環境 | 置き先 |
|---|---|
| ローカル検証 | プロジェクト直下 `.env`（gitignore 済み。`.env.example` をコピー） |
| 本番 Actions | 将来の非公開リポ `calcite-ai/shukatsu-content-ops` の Repository Secrets（[ops/README.md](../ops/README.md)） |
| WP プラグイン（事例AI） | サーバー `wp-config.php` の `SHUKATSU_ANTHROPIC_API_KEY` 定数（または管理画面オプション。個人キー禁止） |

デモ用にこのリポの Actions で dry-run / mock を試す分には、**本番資格情報は入れない**。`workflow_dispatch` の dry-run / mock はキー無しでも動く。

## 変数一覧

| 名前 | 用途 | 必須タイミング |
|---|---|---|
| `ANTHROPIC_API_KEY` | コラム生成（Claude API） | `--wp` で実生成、または `--live` |
| `ANTHROPIC_MODEL` | 任意。既定 `claude-sonnet-4-5-20250929` | 任意 |
| `DRAFT_COUNT` | 件数（1–5）。CLI `--count=` 優先 | 任意 |
| `WP_REST_URL` | 例: `https://shukatsu.or.jp/wp-json` | `--wp` |
| `WP_DRAFT_USER` | 下書き専用 Author（推奨: `shukatsu-draftbot`） | `--wp` |
| `WP_APP_PASSWORD` | Application Password（空白除去して送る） | `--wp` |
| `WP_SITE_ADMIN_URL` | 例: `https://shukatsu.or.jp/wp/wp-admin`（通知の編集URL用） | 任意 |
| `COLUMN_CATEGORY_IDS` | カンマ区切りタームID。本番「ニュース」= `14`（要再確認） | 任意だが本番投入時推奨 |
| `NOTIFY_WEBHOOK_URL` | Slack Incoming Webhook 等 | 任意 |

WP ユーザー作成手順: [wp-draft-user-setup.md](./wp-draft-user-setup.md)

## やってはいけないこと

- 個人 Anthropic キーを本番 Secrets / 本番 `wp-config` に入れる
- チャット・PR・コミットに App Password を貼る
- 通常コラムの自動 `publish`（常に `status: draft`）。ニュース月次のみ例外（[monthly-news-auto.md](./monthly-news-auto.md)）
- キー到着前に cron を有効化する

## 関連

- [pre-api-key-week.md](./pre-api-key-week.md) — キー到着前後のやること
- [phase3-connect-checklist.md](./phase3-connect-checklist.md) — 接続チェック
- [column-draft-pipeline.md](./column-draft-pipeline.md)
