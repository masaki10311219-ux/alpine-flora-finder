# 高山植物早見図鑑

時期・エリア・色・名前・50音順で高山植物を検索できる静的サイトです。写真からの植物識別（画像検索）にも対応しています。

サーバーサイド処理はなく、GitHub Pages / Cloudflare Pages / Netlify などの無料静的ホスティングでそのまま公開できます。

## 主な機能

- 名前検索（部分一致）
- 花期（月）で絞り込み
- エリアで絞り込み
- 花の色で絞り込み
- 50音インデックスでのジャンプ
- 写真アップロードによる植物識別（[Pl@ntNet API](https://my.plantnet.org/) 連携）
- 図鑑内データとの自動マッチング
- 種ごとの図鑑風詳細ページ（`plant.html`）：いきものメモ・注釈付き写真・愛のある紹介文
- みんなの投稿写真＋コメント機能（ログイン不要・ニックネームのみ、Supabase連携）
- Google AdSense 用の広告枠プレースホルダー

## ディレクトリ構成

```
index.html          トップページ（検索・一覧・画像検索）
plant.html           植物1種ごとの図鑑風詳細ページ（?id=で指定）
about.html           このサイトについて／画像出典／投稿ポリシー
privacy.html         プライバシーポリシー（AdSense審査に必要）
css/style.css        スタイル（図鑑風コンポーネント含む）
js/config.js         APIキー・Supabase接続情報の設定
js/wikimedia.js      Wikimedia Commonsから画像・クレジットを取得
js/app.js            検索・絞り込み・一覧表示ロジック
js/image-search.js   Pl@ntNet APIを使った画像検索
js/community.js      Supabase REST/Storage APIを直接叩く投稿・コメント機能
js/plant-detail.js   plant.html のレンダリングロジック
data/plants.json     植物データ（208種、収録項目は下記）
supabase/schema.sql  投稿・コメント機能用のテーブル／RLS定義（SQL Editorで実行）
ads.txt              AdSense審査用（内容は取得後に追記）
```

## セットアップ

### 1. 画像検索（Pl@ntNet API）を有効にする

1. https://my.plantnet.org/ で無料アカウントを作成し、APIキーを取得
2. `js/config.js` の `PLANTNET_API_KEY` に取得したキーを設定

キー未設定の間は「準備中」の案内が表示されるだけで、エラーにはなりません。

無料枠には呼び出し回数の上限があります。アクセスが増えてきたら有料プランや、
サーバー経由でキーを隠す構成（Cloudflare Workers等）への切り替えを検討してください。
（現状はクライアントサイドから直接APIキーを送信するため、キーはブラウザから見える状態になります）

### 2. 広告（Google AdSense）を有効にする

1. Google AdSenseに申し込み、審査を通過する
   - オリジナルコンテンツであること、プライバシーポリシーの設置（`privacy.html` 用意済み）などが審査条件です
   - 申し込み時点では画像の著作権処理（Wikimedia Commonsのクレジット表示）ができている状態にしておくと安心です
2. 発行されたパブリッシャーID・広告ユニットコードを取得
3. `ads.txt` に指定された1行を追記
4. `index.html` 内の `<div class="ad-slot ...">` を、AdSenseが発行する `<ins class="adsbygoogle">` タグに差し替える

### 3. GitHub Pages で公開する

1. リポジトリの Settings → Pages で、公開ブランチを `main`（または該当ブランチ）、ルートディレクトリを `/` に設定
2. 数分後に `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開されます
   - GitHub Pages は Public リポジトリが前提です（無料プランでは Private だと使えません）

### 4. みんなの投稿写真・コメント機能（Supabase）を有効にする

1. https://supabase.com でプロジェクトを作成（無料枠でOK）
2. プロジェクトの **SQL Editor** で `supabase/schema.sql` の内容を実行し、`submissions` / `comments` テーブルと `flower-photos` ストレージバケットを作成
3. プロジェクトの **Settings → API** から `Project URL` と `anon public` キーを取得
4. `js/config.js` の `SUPABASE_URL` / `SUPABASE_ANON_KEY` に設定

設定が完了するまで、各詳細ページの投稿フォームには「準備中です」と表示され、既存機能には影響しません。

ログイン不要・ニックネームのみで誰でも投稿できる設計のため、`supabase/schema.sql` のRLSポリシーは
匿名(anon)ロールからの insert/select を許可しています。投稿は承認なしで即時公開され、
不適切な投稿はコメント欄での報告を前提としたモデレーション方針です（詳細は `about.html` 参照）。
乱用が増えてきた場合は、投稿頻度の制限（Supabase Edge Functions等でのレート制限）の追加を検討してください。

## 植物データの追加・編集

`data/plants.json` に以下の形式でオブジェクトを追加します。

```json
{
  "id": "一意なID（英数字）",
  "name": "カタカナ表記の標準和名",
  "kanji": "漢字表記（任意）",
  "scientific": "学名（Wikimedia Commons検索・Pl@ntNetマッチングに使用）",
  "family": "科名",
  "months": [7, 8],
  "areas": ["北アルプス", "..."],
  "peaks": ["燕岳", "..."],
  "colors": ["白", "..."],
  "desc": "簡単な説明文（一覧カード用）",
  "story": "愛のある紹介文（詳細ページ用）。注目ポイントや、かわいい/かっこいいところを書く。"
}
```

- `peaks`（具体的な山名）は自信を持って言える種のみ設定し、不明な場合は空配列 `[]` にしています。空配列の種は「山名」フィルターには出てきませんが、エリア・時期・色・名前での検索には引き続きヒットします。誤った山名を断定的に書かないよう注意してください。

- 画像は `scientific`（学名）でWikimedia Commonsを検索して自動取得されるため、画像ファイルの用意は不要です。該当画像が無い種はプレースホルダーが表示されます。
- `areas` / `colors` はサイト側でユニークな値を自動集計してフィルターUIを生成するため、新しい値を追加すればフィルターにも自動的に反映されます。

## 今後の拡張予定

### ユーザーによる写真投稿・コメント機能

実装済み（`js/community.js` / `js/plant-detail.js` / `supabase/schema.sql`）。ログイン不要・ニックネームのみで投稿でき、
投稿は承認なしで即時公開、不適切な投稿はコメントでの報告を前提としたモデレーション方針です。

利用にはSupabaseプロジェクトの作成が必要です（上記セットアップ手順4を参照）。Googleログインでの本人確認は
今回は導入していません。将来的に必要になった場合は、Supabase Auth + Google OAuth（Google Cloud Console側の
クライアント作成が別途必要）への切り替えを検討してください。

### 植物データのさらなる拡充

現在208種。Wikipedia日本語版のCategory:高山植物を参照し、学名・分布を確認できた種を中心に拡充した。
さらに拡充する場合も、既存データと同様に一次情報（Wikipedia・専門図鑑等）で学名を確認してから追加することを推奨する。

## 開発上の注意（このセッションでの制約）

このコードを作成した開発環境（サンドボックス）はネットワーク送信先が制限されており、
Wikimedia Commons API・Pl@ntNet APIへの疎通確認はできていません。API仕様に基づいて実装していますが、
公開後に実際のブラウザから動作確認（画像が表示されるか、画像検索が動くか）を行ってください。

## 免責

花期・分布は代表的な傾向を簡略化して掲載しています。画像識別結果はAIによる自動推定であり、
食用・薬用可否や毒性の判断など安全に関わる用途には使用しないでください（`about.html` にも記載）。
