# デモ買い取り — 公開URL手順（GitHub Pages）

> 2026-08-20  
> 穴 P0-1 の閉じ方。**勝手に push しない**（オーナー明示時のみ）。

## 公開URLの形

```
https://calcite-ai.github.io/calcite-demos/buyout-prospects/{slug}/
https://calcite-ai.github.io/calcite-demos/buyout-prospects/{slug}/{skin}/
```

例:
- 一覧: `.../buyout-prospects/ishizaka-koumuten/`
- 標準A案: `.../buyout-prospects/<slug>/e-taisei/`（E案）
- 標準B案: `.../buyout-prospects/<slug>/f-sanyu/`（F案）
- 旧在庫（明示指定時のみ）: `b-atelier` / `c-daylight` / `c-refresh` / `d-signboard`

ローカル生成物 `buyout-template/designs/_prospects/` は **送らない・pushしない**（作業用）。  
送付用の正本はリポジトリ直下の **`buyout-prospects/`**。

## 手順（1社）

```bash
cd ~/claude/02_hp-sales/demos/buyout-template/designs

# 1. 差し替え（在庫2骨格 — 刷新レイアウトは c-refresh 推奨）
node swap-prospect.mjs \
  --skins e-taisei,f-sanyu \
  --name "株式会社サンプル" \
  --tag "地域の〇〇を支えます" \
  --tel "03-1234-5678" \
  --email "info@example.com" \
  --address "東京都…" \
  --slug sample-co

# 2. 送付用フォルダへ同期（noindex 付与）
node publish-prospect.mjs --slug sample-co
```

3. ローカル確認: `buyout-prospects/{slug}/` をブラウザで開く（または http.server）
4. オーナーに「この slug を Pages に載せてよいか」確認
5. **明示OK後のみ** `demos` で commit → push `main`
6. 1〜2分待ち、上記 https が 200 になることを確認
7. CSV の `demo_url_a` / `demo_url_b` に https を記入 → `status=built` → 送信後 `sent`

## やらないこと

- `_prospects` を remote に載せる
- 送付バッチ以外のタイミングで buyout を自動 push
- 初回メールに Checkout URL を載せる

## 削除

商談終了・STOP後は `buyout-prospects/{slug}/` を削除して push（任意・四半期でも可）。
