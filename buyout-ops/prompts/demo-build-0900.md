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

   - ★登録URLが現行の公式サイトかを確認する:
       node buyout-ops/verify-official-site.mjs --company "<社名>" --url "<site_url>" --where "<市区町村>"
       verdict=superseded なら **デモを作らない**。CSV を status=paused にし、
       notes に現行URLを書いて次の社へ進む（URL差し替えは人が判断する）
       verdict=unknown なら制作を止め、notes に「公式サイト要確認」と書いて次へ
       （2026-09-07 ＫＡＺ空間企画: 廃止済みの旧サイトを診断して送信。
         旧サイトも 200 を返し社名・住所・TEL が一致するため C0 では防げない）

   - 先方HPの会社概要ページを実際に開いて読む。
     代表者名・建設業許可番号・住所・TEL・営業時間・事業内容・採用の有無を控える。
     HPに書いていない項目は載せない。捏造しない。

   - 読んだ内容の中に「際立つ事実」（例: 創業100年超、希少な資格、
     珍しい認定・受賞、突出した業歴）が **あるときだけ** 「強み1行」を書き、
     CSVの notes に保存する（2026-09-08 オーナー方針）:
       notes に  強み：<1文>|  を追記する（既存の notes は消さない）
       ・際立つ事実が無ければ、この行自体を書かない（notes に 強み： を
         追記しない）。render-outreach-email.mjs が自動で行ごと省略する
         （汎用文で埋めて水増ししない）
       ・書くときは、複数の事実を並べた説明文にしない。際立つ「1つの事実」
         だけを選び、それに対する短い所感にする
       ・先方HPに書いてある事実だけを使う（創業年・許可・資格・受賞・認定・
         加盟団体・自社の言葉。事実そのものの推測・捏造は禁止）
       ・「御社のホームページを拝見しました。」の次行に置かれる1文として書く
       ・40字程度まで。句点は自動で付くので無くてよい
       ・文末を「〜な会社です」という定義文・カテゴリ分けで終えない
         （2026-09-08 宮川建設で実際に送信してオーナーから指摘あり:
         「創業昭和21年、特定建設業許可と宅地建物取引業の登録を持つ
         地域の建設会社です」→ NG。事実の説明文で、所感になっていない）
       良い例（際立つ事実がある）：
         強み：創業から100年を超えていらっしゃることに驚きました|
         強み：一級建築士事務所を併設されているのですね|
       良い例（際立つ事実が無い）：notes に 強み： を書かない
         （メールは「拝見しました。」の次に空行を1つ挟んで
          「そのうえで、外から見えて…」に続く）
       NG例：強み：創業昭和21年、特定建設業許可と宅地建物取引業の登録を
             持つ地域の建設会社です|（事実の羅列＋定義文で、所感がない）

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

   - ★第三者チェック（作った本人の自己採点だけで queued にしない。
     2026-09-08 小畑工務店: 本人チェックでは建築士事務所登録番号の
     1桁脱字を見逃し、独立した二次チェックで発見・修正した）:
       - このビルドの記憶がない状態（別エージェント／新しいチャット）で、
         公開されたデモURLと先方HPを実際に開いて比較させる
       - 見るもの: 代表者・住所・電話・許可/登録番号・設立・資本金・
         従業員数・事業内容・営業時間が「一字一句」一致しているか
         （番号は特にすり合わせが甘くなりやすい）。禁止表現（本文ゲートの
         FORBIDDEN 一覧）の残存。ページ間（トップ/about/services）の
         見出し・事実の矛盾。捏造疑い（先方HPに書いていない情報）
       - PASS/FAILと具体的な差分を報告させる
       - FAILなら直して publish-prospect.mjs をやり直し、
         もう一度この第三者チェックを通す（PASSになるまでループ）
       - Claude Code から実行しているときは Agent ツールで
         general-purpose サブエージェントを1体立てて検証させる
         （建てたエージェント自身に検証させない）

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
| 2026-09-08 | 「強み1行」を方針転換: 際立つ事実がある時だけ、その1事実への所感を書く。無ければ行ごと省略（`render-outreach-email.mjs`の汎用文フォールバックも撤去） |
| 2026-09-08 | publish直後に第三者チェック（独立エージェント／別チャット）を必須化。本人の自己採点だけでは登録番号の脱字・見出し不一致を見逃した実例あり |
| 2026-09-06 | このファイルを新設し正本化。`--hours`・強み1行・採用文言・390px改行を追加 |
| 2026-09-05 | 実物が正本から4行ズレていることが判明（HP読み込み・FACT照合・`skin_pair`・`demo_url_b`） |
