# 営業専用ドメイン — 最小LP

工務店コールドメールのフッター `Web:` 用 + **デモ短縮URL** 用。

## デモ短縮 URL（メール本文）

メールには GitHub Pages ではなく次の形式を載せる:

```
https://www.calcite-mail.jp/demo/{slug}/{skin}/
```

`buyout-ops/generate-demo-redirects.mjs` が `demo/{slug}/{skin}/index.html` を生成する（GitHub Pages へ即時リダイレクト）。

**デプロイ:** ConoHa WING の `calcite-mail.jp` 公開ディレクトリに `demo/` フォルダごとアップロード（`index.html` と同階層）。

## デプロイ（ConoHa WING）

1. ドメイン取得後、WING で公開用ディレクトリを作成
2. `index.html` と `demo/` をアップロード
3. `www.<ドメイン>` と apex が同ページを指すよう設定
4. 確定ドメインが `calcite-mail.jp` 以外の場合、`index.html` の Mail 行を更新

手順詳細: `02_hp-sales/sales/knowledge/demo_buyout_outreach_domain.md`

## 切替前

- このページを公開してから **14日間**、新ドメインからの送信は行わない
- メール From / GitHub Secrets の切替は切替日に一括実施
