# デモ買い取り — 送信前ゲート（必須）

> 2026-08-21 追加（福澤: Pages 404 / ヒーローにアオイ工房残存）  
> **1つでも NG なら送らない。** 文面のオーナー確認は不要でも、このゲートは必須。

## 機械チェック（先に実行）

```bash
cd ~/claude/02_hp-sales/demos
node buyout-ops/verify-ops-pack.mjs
node buyout-ops/verify-hunter-g1.mjs --from-csv --company "株式会社〇〇"
node buyout-ops/verify-before-send.mjs --slug <slug> --name "株式会社〇〇"
# または CSV の1行から:
node buyout-ops/verify-before-send.mjs --from-csv --company "株式会社福澤工務店"
```

`verify-before-send` は内部で **verify-ops-pack も実行** する。  
返信で checkout / followup を送る前:

```bash
node buyout-ops/verify-inbox-reply.mjs --company "株式会社〇〇" --template checkout
```

終了コード `0` 以外 → **送信禁止**。

## 人手チェック（送信直前）

```
□ P0  対象が queued/built で do_not_contact=false かつ **prior_outreach_blocklist に未掲載**
□ P1  Gmail: to:{email} from:me で過去送信なし
□ P2  C0〜C2 再確認（正規サイト・最終HTTPS・tel:）
□ P3  メール課題①〜③ = audit_notes の粗だけ（新規指摘を足していない）
□ P4  verify-ops-pack.mjs + verify-before-send.mjs が PASS
□ P5  デモ案A/B URL がメール本文と CSV で一致
□ P6  今日すでに1通送っていない（週7以内・土日含む）
□ P7  テンプレ・buyout-prospects を変えた場合、**送信前に main へ push 済み**
```

## verify が見るもの（自動）

| ID | 内容 | 失敗時 |
|---|---|---|
| V1 | `demo_url_a` / `demo_url_b` が HTTPS で **HTTP 200** | 送らない（push待ち or 作り直し） |
| V2 | 公開HTMLに **アオイ** / **アオイ工房** / サンプル住所・仮TELが残っていない | swapやり直し |
| V3 | 公開HTML（トップ）に **先方社名** が含まれる | swapやり直し |
| V4 | CSV の skin と URL パスが一致（例: `.../d-signboard/`） | CSV or URL 修正 |
| V5 | slug フォルダが `buyout-prospects/` に存在する（ローカル確認） | publish 漏れ |
| V6 | 公開HTMLに **55,000 / 50,000** が残っていない | swap/publish やり直し |
| V7 | 公開HTMLに **デモ案一覧** / picker バーが残っていない | publish やり直し |
| V8 | 初回メールテンプレに **66,000** があり旧価格がない | push / テンプレ修正 |
| V9 | queued/built の **quoted_price=66000** | CSV修正 |
| V10 | slug 直下 **index.html（中間ページ）がない** | publish やり直し |
| O1〜O8 | `verify-ops-pack.mjs`（テンプレ・repo・GitHub main 一致） | push / 修正 |
| I2 | `verify-inbox-reply.mjs`（旧価格コホートに66k checkout 禁止） | オーナー対応 |
| V11/O11 | queued が **工務店（koumuten）** 以外 | 送信・昇格禁止 |
| V12 | **`prior_outreach_blocklist.csv` に載る**（個人Gmail・hello@ 含む過去デモ営業済） | 送らない |
| V13 | **G1**: 相手サイトがモダン除外 / audit_notes に粗2点未満 / G1不合格 | 送らない（石川型） |

## 過去ミスとの対応

| ミス | ゲート |
|---|---|
| 404 URLを送った | V1 |
| ヒーローにアオイ工房 | V2 / V3 |
| httpsなのにhttp指摘 | P2 / C1 |
| tel:見逃し | P2 / C2 |
| 新公式があるのに旧を突く | P2 / C0 |
| **旧価格テンプレのまま送信** | **V8 / O8 / P7** |
| **デモ中間ページ・picker** | **V7 / V10 / O3-O4** |
| **旧価格先に66k決済** | **I2 / quoted_price** |
| **新しいサイトに buyout 送信（石川）** | **V13 / verify-hunter-g1** |

詳細: [`demo_buyout_incidents.md`](./demo_buyout_incidents.md)
