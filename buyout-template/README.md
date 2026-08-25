# デモサイト買い取り — テンプレ一式

架空サンプル: **アオイ工房**

## 本番運用（在庫4 → 送付2）

実送付用のデザイン在庫はここ:

**`designs/`** — A Sumi / B Atelier / C Daylight / D Signboard（見た目）  
業種の中身は `designs/verticals/`（koumuten / zeirishi / sougi）。詳細: `../../sales/knowledge/demo_buyout_verticals.md`

| 手順 | 内容 |
|---|---|
| 1 | `http://127.0.0.1:8765/designs/` で在庫確認 |
| 2 | 先方に合う **2骨格** を選ぶ |
| 3 | `node designs/swap-prospect.mjs` で社名など差し替えコピーを出力 |
| 4 | 2URLを送付 →「どちらかでよければ55,000円（税込）で買い取り」 |
| 5 | 決済後は選ばれた1本だけ本差し替え納品 |

運用詳細: `../../sales/knowledge/demo_buyout_design_inventory.md`

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
