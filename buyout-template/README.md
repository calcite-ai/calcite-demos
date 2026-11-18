# デモサイト買い取り — テンプレ一式

架空サンプル: **アオイ工房**

## 本番運用（標準は E案1本）

実送付用のデザイン在庫はここ:

**`designs/`** — 標準 **E Taisei**。F および A〜D は在庫として残置。

| 手順 | 内容 |
|---|---|
| 1 | `http://127.0.0.1:8765/designs/e-taisei/` で標準テンプレ確認 |
| 2 | `node designs/swap-prospect.mjs` で社名など差し替え（省略時スキンは e-taisei） |
| 3 | 1URLを送付 →「この方向でよければ66,000円（税込）で買い取り」 |
| 4 | 決済後はそのデモを差し替え納品 |

運用詳細: `../../sales/knowledge/demo_buyout_design_inventory.md`

## 士業向け（2026-11-18〜）

**`designs/g-shigyo/`** — 行政書士・司法書士・社労士・税理士・土地家屋調査士向け。写真なし。
生成は `node designs/swap-shigyo.mjs`（`--sample` で架空データの見た目確認）。
手順の差分は `../buyout-ops/prompts/demo-build-shigyo.md`。

## 旧ルート雛形

リポジトリ直下の `index.html` 等は初期クリーム案。送付は **`designs/` 側**を使う。

## ローカル確認

```bash
cd ~/claude/02_hp-sales/demos/buyout-template
python3 -m http.server 8765
# 在庫一覧 http://127.0.0.1:8765/designs/
```

HTML再生成（文言・ページ構成を直したあと）:

```bash
node designs/build-sites.mjs
```

公開はオーナー指示があるまで push しない。
