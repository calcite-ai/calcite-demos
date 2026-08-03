# CPT / ACF 設計案（WordPress本番）

> 前提: 本番は現行WPサーバー流用。Astroデモは見た目・構成の見本。  
> xo_event（踊活レッスン）との統合は**未定**のため、本設計ではトピックスを独立CPTとする。  
> 運用手順（担当者向け）: [`トピックス_事例集_コラム_更新手順書.md`](./トピックス_事例集_コラム_更新手順書.md) / [docx](./トピックス_事例集_コラム_更新手順書.docx)  
> ※ 事例Intakeの選択肢は手順書（2026-07）に同期済み。

---

## 1. 全体方針

| 方針 | 内容 |
|---|---|
| 新規CPT | `shukatsu_topic` / `shukatsu_case` / `shukatsu_column` / `shukatsu_faq` / `shukatsu_guide` |
| 既存維持 | `xo_event`（XO Event Calendar）は触らない（踊活カレンダー用） |
| 固定ページ | トップ・サービス・流れ・会社・踊活・対象者別・お問い合わせ等は通常の固定ページ＋ACF |
| 公開制御 | WP標準の `draft` / `pending` / `publish` を使う（独自statusフィールドは補助のみ） |
| AI下書き | コラム・事例は `draft` でREST投稿。`ai_generated` / `needs_review` をACFで明示 |
| 権限 | 自動投稿用は Author 専用ユーザー＋アプリケーションパスワード |

スラッグ接頭辞 `shukatsu_` は、既存プラグインCPTとの衝突回避用。公開URLはリライトルールで日本語フレンドリーにしてもよい（例: `/cases/`, `/columns/`）。

---

## 2. CPT一覧

| CPT（内部名） | 管理画面表示名 | アーカイブURL案 | REST | 備考 |
|---|---|---|---|---|
| `shukatsu_topic` | トピックス | （アーカイブ不要可） | 有効 | トップの進捗・お知らせ。1行〜短文 |
| `shukatsu_case` | 解決事例 | `/cases/` | 有効 | 匿名化必須。ACF入力→AI下書き想定 |
| `shukatsu_column` | コラム | `/columns/` | 有効 | AI週次下書き想定 |
| `shukatsu_faq` | FAQ | `/faq/`（または固定ページ内） | 有効 | Q&A単位で1投稿 |
| `shukatsu_guide` | 制度解説 | `/guides/` | 有効 | 成年後見・家族信託など比較記事 |
| `xo_event`（既存） | イベント | プラグイン準拠 | 既存 | **レッスン予定専用。トピックスと混ぜない** |

### 共通CPT設定（推奨）

- `public` / `show_in_rest` = true  
- `has_archive` = topic以外 true  
- `supports` = title, editor（本文）, revisions（column/case/guide）, custom-fields  
- topic は `editor` 任意（ACFのリンクだけで足りる場合あり）  
- menu_icon: topic=megaphone, case=portfolio, column=welcome-write-blog, faq=editor-help, guide=book-alt  

---

## 3. タクソノミー

| タクソノミー | 対象CPT | 種類 | 初期ターム |
|---|---|---|---|
| `case_category` | case | 非階層・**複数可** | 身元保証 / 入院保証 / 老人ホーム入居 / 成年後見 / 死後事務 / 相続 / 生活保護 / 認知症対応 |
| `column_category` | column | 非階層 | ニュース / 身元保証 / 制度・安心 / …（デモ準拠、運用で追加可） |
| `faq_category` | faq | 非階層 | サービス / 料金 / 契約 / 専門職向け 等 |
| `topic_category` | topic | 非階層 | メディア / お知らせ / 更新情報 / その他（任意） |
| `xo_event_cat`（既存） | xo_event | 既存 | レッスン（現状） |

- カテゴリは「投稿のカテゴリー」を流用せず、**専用タクソノミー**にする（投稿・Jetpackと混線しないため）。  
- 相談者属性（誰からの相談か）はタクソノミーではなく **ACFの Select** にする（手順書の7択と一致。フロントの「カテゴリ絞り込み」は `case_category` のみ）。

---

## 4. ACFフィールド設計

### 4.1 トピックス（`shukatsu_topic`）— グループ: Topic Fields

担当者がそのまま公開する想定。必須を最小にする。

| フィールド名 | タイプ | 必須 | 説明 |
|---|---|---|---|
| `topic_date` | Date Picker | ✅ | 表示日（タイトル下の日付） |
| `topic_link_type` | Select | ✅ | `none` / `internal` / `external` |
| `topic_internal_url` | Page Link または URL | 条件 | 内部ページへのリンク |
| `topic_external_url` | URL | 条件 | 外部リンク |
| `topic_pin` | True/False | | トップ固定（任意） |

- 投稿タイトル = トピックス本文（1行）  
- 本文エディタは基本使わない（説明を残すなら任意）  

### 4.2 解決事例（`shukatsu_case`）— グループ: Case Intake（入力）+ Case Display（表示）

壁打ちどおり「プルダウンで整理→AI下書き」向け。

#### Case Intake（担当者入力・AIの材料）※手順書に同期

| フィールド名 | タイプ | 必須 | 選択肢（手順書どおり） |
|---|---|---|---|
| `case_audience` | Select | ✅ | 本人 / ご家族 / ケアマネジャー / 病院MSW / 地域包括支援センター / 老人ホーム / 紹介会社 |
| `case_category` | Checkbox または タクソノミー複数 | ✅ | 身元保証 / 入院保証 / 老人ホーム入居 / 成年後見 / 死後事務 / 相続 / 生活保護 / 認知症対応 |
| `case_age_band` | Select | ✅ | 60代 / 70代 / 80代 / 90代以上 |
| `case_family` | Select | ✅ | 独居 / 配偶者あり / 子と同居 / 子はいるが疎遠 / 親族なし |
| `case_period` | Select | ✅ | 即日 / 1週間以内 / 1ヶ月以内 / 3ヶ月以内 / 3ヶ月以上 |
| `case_actions` | Checkbox | ✅ | 身元保証契約締結 / 施設入居手続き代行 / 緊急連絡先対応 / 死後事務委任契約 / 財産管理サポート / 成年後見制度利用支援 |
| `case_result` | Select | ✅ | 解決・契約継続中 / 解決・支援終了 / 他機関へ紹介 / 継続対応中 |
| `case_background` | Textarea | ✅ | 相談の背景・きっかけ（1〜2文） |
| `case_point_note` | Textarea | ✅ | 対応のポイント・工夫した点（1〜2文） |
| `case_anonymized` | True/False | ✅ | 匿名化確認。**未チェックは公開不可**（バリデーション） |

フロントのカテゴリ一覧・絞り込みは `case_category`（複数可）を使う。

#### Case Display（公開ページ用・AI生成 or 手修正）

本文エディタにMarkdown相当の構成を載せるか、ACFの繰り返しに分けるか二案ある。**推奨は本文＋見出し規約**（デモと同じ読みやすさ）。

本文の推奨見出し（エディタ内）:

1. 冒頭結論（太字1〜2文）  
2. この事例で分かること  
3. 相談内容  
4. 課題  
5. 対応内容  
6. 結果  
7. ポイント  
8. FAQ（任意）  

補助ACF:

| フィールド名 | タイプ | 説明 |
|---|---|---|
| `meta_description` | Text | SEO。未入力時は抜粋から生成可 |
| `ai_generated` | True/False | AI下書き由来 |
| `needs_review` | True/False | 要確認（一覧で目立つように） |
| `og_image` | Image | 任意 |

### 4.3 コラム（`shukatsu_column`）— グループ: Column Fields

| フィールド名 | タイプ | 必須 | 説明 |
|---|---|---|---|
| `meta_description` | Text | ✅ | SEO |
| `source_url` | URL | 条件付き | 制度・数字を含む記事は**推奨必須** |
| `ai_generated` | True/False | | 自動下書きフラグ |
| `needs_review` | True/False | | 要確認 |
| `og_image` | Image | | OGP |

- カテゴリは `column_category`  
- 本文はブロックエディタ  
- 公開日はWPの投稿日を使用（予約投稿可）  

### 4.4 FAQ（`shukatsu_faq`）

| フィールド名 | タイプ | 必須 |
|---|---|---|
| （タイトル） | = 質問文 | ✅ |
| 本文 | = 回答 | ✅ |
| `faq_order` | Number | 表示順 |
| `meta_description` | Text | 任意（一覧ページ側でまとめても可） |

JSON-LD `FAQPage` はアーカイブまたは固定ページで、公開済みFAQをまとめて出力。

### 4.5 制度解説（`shukatsu_guide`）

| フィールド名 | タイプ | 必須 |
|---|---|---|
| `meta_description` | Text | ✅ |
| `og_image` | Image | |
| `needs_review` | True/False | 制度記事は原則ONで開始可 |

---

## 5. 固定ページ用ACF（概要のみ）

CPT外だが、同時に決めておくと実装が楽。

| ページ | 主なACF |
|---|---|
| トップ | ヒーロー文言、TOPICS件数、サービス3カード、悩みリスト |
| サービス | ささえ／おとも／むかえ料金表（繰り返しフィールド） |
| 対象者別（6種） | lead、悩み、関連事例（Relationship → case）、CTA |
| 会社概要 | 代表プロフィール、資格（繰返）、沿革（繰返） |
| ガイドライン | 遵守項目表（繰返） |

---

## 6. 公開フローとフィールドの対応

```
[コラム] Actions週次 → RESTで draft + ai_generated=true + needs_review=true
       → 担当者が修正 → publish（needs_review=false）

[事例]  Intake入力 → Webhook/手動でAI下書きを本文へ
       → case_anonymized必須 → pending or draft
       → 管理者確認 → publish

[トピックス] 担当者が直接入力 → そのまま publish
```

`needs_review=true` の投稿は管理画面リストに「要確認」列を出す（ACFカラム表示）。

---

## 7. REST API（自動下書き用）

| 用途 | エンドポイント案 |
|---|---|
| コラム下書き作成 | `POST /wp-json/wp/v2/shukatsu_column` |
| 事例下書き更新 | `POST/PUT /wp-json/wp/v2/shukatsu_case` |
| トピックス一覧（フロント） | `GET /wp-json/wp/v2/shukatsu_topic?per_page=5&orderby=meta_value&meta_key=topic_date` |

ACFの `show_in_rest` を有効にするか、`acf-to-rest-api` 等でメタを露出。自動投稿ユーザーは **Authorのみ**（publish権限なしが理想。ContributorだとREST制限があるため、運用で「draftのみ作成する専用Author」＋公開は人間、が現実的）。

---

## 8. xo_event との境界（再掲・未定でも設計は固定）

| | トピックス `shukatsu_topic` | イベント `xo_event` |
|---|---|---|
| 目的 | 進捗・お知らせ・メディア | レッスンスケジュール |
| UI | 日付＋1行リスト | カレンダー |
| 更新者 | 事務・広報 | 踊活担当 |
| 統合 | **しない（本設計）** | 現状維持 |

将来「最近の動き」にレッスンも混ぜたい場合は、**表示側で2CPTを結合**する（データ統合はしない）。

---

## 9. デモ（Astro）からの対応表

| Astro | WordPress |
|---|---|
| `src/data/topics.ts` | `shukatsu_topic` |
| `src/content/cases/*.md` | `shukatsu_case` |
| `src/content/columns/*.md` | `shukatsu_column` |
| `src/content/faq/*.md` | `shukatsu_faq` |
| `src/content/guides/*.md` | `shukatsu_guide` |
| 対象者ページ等 | 固定ページ + ACF |

---

## 10. 実装順序（提案）

1. CPT＋タクソノミー登録（テーマ `functions.php` または専用小さなプラグイン）  
2. ACFフィールドグループJSONを書き出し／インポート  
3. パーマリンク・アーカイブテンプレ  
4. トピックスをトップに表示  
5. 事例IntakeフォームのUI調整（匿名化チェック必須）  
6. コラムREST下書きをAstroスクリプトからWP向けに移植  

---

## 確認してほしい点

1. CPTを5つ（topic/case/column/faq/guide）でよいか。FAQをCPTにせず「固定ページ＋繰り返し」にする案もある  
2. 事例の本文は「見出し規約つき1本文」でよいか、ACFセクション分割がよいか  
3. トピックス独立で進めてよいか（xo_event統合は引き続き見送り）← 手順書mdでは独立表記に修正済み  

OKなら次は、ACFフィールドグループのインポート用定義（JSON）か、`register_post_type` の実装コード草案に進める。

---

## 実装キット（準備済み）

ログイン前に作成済み。配置場所: [`../wordpress/`](../wordpress/README.md)

| 内容 | パス |
|---|---|
| CPTプラグイン草案 | `wordpress/plugins/shukatsu-content/` |
| ACF JSON | `wordpress/acf-json/` |
| REST下書き仕様 | `wordpress/docs/REST下書き仕様.md` |
