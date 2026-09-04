// サイト設定。値を取得したら書き換えてください。
const SITE_CONFIG = {
  // PlantNet の無料APIキー（https://my.plantnet.org/ で取得）
  // 未設定の間は画像検索が「準備中」の案内を表示します。
  PLANTNET_API_KEY: "",

  // Google AdSense のパブリッシャーID（例: "ca-pub-1234567890123456"）
  // 設定後、index.html の広告枠コメント部分を AdSense の <ins> タグに差し替えてください。
  ADSENSE_PUBLISHER_ID: "",

  // みんなの投稿写真・コメント機能用の Supabase 設定
  // プロジェクトの Settings → API から取得してください。
  // 未設定の間は詳細ページの投稿機能が「準備中」の案内を表示します。
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};
