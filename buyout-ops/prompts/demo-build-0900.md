# 9:00 デモ制作プロンプト（正本）

> **これが正本。** Cursor Automation にはこのファイルの内容を貼る。
> doc 側にコピーを置かない（2026-09-05: 実物が正本から4行ズレていた。
> HPを読む指示・FACT照合・`skin_pair`・`demo_url_b` が欠落し、
> ダミーの営業時間が実在企業名のページで公開された）。
>
> 変更したらこのファイルを直し、Automation に貼り直す。
> 将来 GitHub Actions に移す際も、このファイルを唯一の出所とする。

```text
git pull origin main

cd buyout-ops がある calcite-demos リポジトリ root で作業する。
正本: buyout-ops/demo_buyout_daily_schedule.md
通数: buyout-ops/send-quota.csv（当日残枠ぶんだけデモを作る）
ルール: CLAUDE.md（本文ゲート・push・390px）

重要（最優先）:
- Pull Request / Draft PR は作らない（作成したら失敗）
- 変更は必ず git push origin main
- GitHub Pages は main 反映後しか 200 にならない
- node buyout-ops/verify-before-send.mjs が PASS（Pages 200）になるまで終了しない

残枠が埋まるまで繰り返す:

1) node buyout-ops/refill-queue-if-empty.mjs

2) 終了コード 0 → ループ終了（枠満了／在庫足りている）
3) 終了コード 2 → ループ終了（承認キューなし。hunter-suggest しない）

4) 終了コード 3 → 承認キュー先頭1社だけデモ制作（工務店のみ）:

   - node buyout-ops/next-approved.mjs で社名確認
   - node buyout-ops/verify-hunter-g1.mjs --from-csv --company "<社名>" PASS
   - 税理士・葬儀は絶対に queued にしない（vertical=koumuten のみ）
   - 承認リスト外の hunter-suggest は使わない

   - 先方HPの会社概要ページを実際に開いて読む。
     代表者名・建設業許可番号・住所・TEL・営業時間・事業内容・採用の有無を控える。
     HPに書いていない項目は載せない。捏造しない。

   - 読んだ内容から「強み1行」を書き、CSVの notes に保存する:
       notes に  強み：<1文>|  を追記する（既存の notes は消さない）
       ・先方HPに書いてある事実だけを使う（創業年・許可・資格・受賞・認定・
         加盟団体・自社の言葉。推測や褒め言葉の創作は禁止）
       ・「御社のホームページを拝見しました。」の次行に置かれる1文として書く
       ・60字程度まで。句点は自動で付くので無くてよい
       ・pay_signals の汎用文（「法人としての事業体制がうかがえる」）を
         そのまま使わない
       例：強み：創業昭和28年、一級建築士事務所を併設され、ISO 9001・14001も
           取得されています|

   - node buyout-template/designs/swap-prospect.mjs --skins e-taisei
       --name / --tel / --address / --email / --slug は上で読んだ値を使う
       --hours は先方HPで営業時間を確認できたときだけ渡す
         （例: --hours "平日 8:00-17:00"）。
          確認できなければ渡さない＝「ご購入後に反映します」になる
       先方サイトから画像を拾わない（在庫 Unsplash / AI 素材のみ）

   - キャッチ（--tag）は先方HPの自社表現から取る。390pxで単語の途中で
     改行しない長さにする（目安20字以内）

   - 採用ページの「現在、募集は行っておりません」は事実確認できないので
     「採用情報は、ご購入後のヒアリングのうえ反映します。」に置き換える

   - node buyout-ops/verify-demo-content.mjs --from-csv --company "<社名>" PASS
     ＋ 出力の FACT を先方HPで手照合
   - 主要ページを幅〜390pxで確認（横スクロール・文字切れ・改行位置）

   - node buyout-template/designs/publish-prospect.mjs --slug <slug>

   - demo_buyout_leads.csv:
       status=queued, quoted_price=66000, vertical=koumuten,
       skin_pair=e-taisei, demo_url_a 記入, demo_url_b は空のまま
       （approval_seq は変えない）

   - buyout-prospects と leads CSV を同じコミットで origin main へ直接 push
   - node buyout-ops/verify-ops-pack.mjs PASS（O10 が skin_pair 空を検出する）
   - node buyout-ops/verify-before-send.mjs --from-csv --company "<社名>" PASS まで
   - 再度 1) に戻る

禁止:
- 66k 以外の価格でメール送信
- quoted_price=55000 の3社（新見・福澤・日南）への決済メール
- オーナー未承認の hunter-suggest で queued を増やす
- PR / Draft PR を開いて終了すること
- 先方ホームページから画像を拾ってデモに使うこと
- verify FAIL のまま放置すること（失敗理由を notes に残す）
```

## 変更履歴

| 日付 | 変更 |
|---|---|
| 2026-09-06 | このファイルを新設し正本化。`--hours`・強み1行・採用文言・390px改行を追加 |
| 2026-09-05 | 実物が正本から4行ズレていることが判明（HP読み込み・FACT照合・`skin_pair`・`demo_url_b`） |
