# 営業専用ドメイン — 最小LP

工務店コールドメールのフッター `Web:` 用。

## デモURLとクリック計測（現行・2026-09-03 以降）

**メール本文には GitHub Pages のデモURLをそのまま書く。** 追跡は **SendGrid** が行う。

```
https://calcite-ai.github.io/calcite-demos/buyout-prospects/{slug}/{skin}/
```

| 対象 | 計測 |
|---|---|
| デモURL | **SendGrid の Activity**（`clicktrack.enable=1` / HTML のみ・`enable_text: false`） |
| カルサイトHP（署名 `calcite-ai.jp`） | HTML で `clicktracking=off`。計測対象外 |

実装: `sendgrid-smtp-headers.mjs`（追跡ON）/ `render-outreach-email.mjs`（`canonicalDemoUrl` を使う）。

### やらないこと（旧方式・運用停止）

- **`https://www.calcite-mail.jp/demo/{slug}/{skin}/` をメール本文に書かない**
- `generate-demo-redirects.mjs` の PHP クリックログは使わない（ConoHa への `demo/` 同期も不要）
- `publicDemoUrl()` をメール本文に使わない（`publish-prospect.mjs` の表示用のみ）

サーバー上に残っている `demo/` は害はないが、更新しない。切替の経緯は `demo_buyout_incidents.md`。

## デプロイ（ConoHa WING）

1. ドメイン取得後、WING で公開用ディレクトリを作成
2. `index.html` と `demo/` をアップロード
3. `www.<ドメイン>` と apex が同ページを指すよう設定
4. 確定ドメインが `calcite-mail.jp` 以外の場合、`index.html` の Mail 行を更新

手順詳細: `02_hp-sales/sales/knowledge/demo_buyout_outreach_domain.md`

## 切替前

- このページを公開してから **14日間**、新ドメインからの送信は行わない
- メール From / GitHub Secrets の切替は切替日に一括実施
