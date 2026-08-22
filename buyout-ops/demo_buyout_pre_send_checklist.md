# デモ買い取り — 送信前ゲート（必須）

> 2026-08-21 追加（福澤: Pages 404 / ヒーローにアオイ工房残存）  
> **1つでも NG なら送らない。** 文面のオーナー確認は不要でも、このゲートは必須。

## 機械チェック（先に実行）

```bash
cd ~/claude/02_hp-sales/demos
node buyout-ops/verify-before-send.mjs --slug <slug> --name "株式会社〇〇"
# または CSV の1行から:
node buyout-ops/verify-before-send.mjs --from-csv --company "株式会社福澤工務店"
```

終了コード `0` 以外 → **送信禁止**。

## 人手チェック（送信直前）

```
□ P0  対象が queued/built で do_not_contact=false
□ P1  Gmail: to:{email} from:me で過去送信なし
□ P2  C0〜C2 再確認（正規サイト・最終HTTPS・tel:）
□ P3  メール課題①〜③ = audit_notes の粗だけ（新規指摘を足していない）
□ P4  verify-before-send.mjs が PASS
□ P5  デモ案A/B URL がメール本文と CSV で一致
□ P6  今日すでに1通送っていない（週5以内）
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

## 過去ミスとの対応

| ミス | ゲート |
|---|---|
| 404 URLを送った | V1 |
| ヒーローにアオイ工房 | V2 / V3 |
| httpsなのにhttp指摘 | P2 / C1 |
| tel:見逃し | P2 / C2 |
| 新公式があるのに旧を突く | P2 / C0 |
