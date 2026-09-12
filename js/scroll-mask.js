/**
 * 「このサイトについて」ページ冒頭のピン留め型スクロールヒーロー。
 * セクション内をスクロールする間、文字の形に切り抜いた花写真がズームして見える。
 */
(() => {
  const MASK_SCIENTIFIC = "Dicentra peregrina";

  // Wikimedia画像が見つからない場合のフォールバックは、通常のプレースホルダー
  // （「画像準備中」の文字入りSVG）だと文字トリミングの中に別の文字が透けて見えて
  // しまうため、ここでは文字を含まない単色グラデーションを使う。
  const MASK_FALLBACK = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#8fbb9f"/><stop offset="100%" stop-color="#6fa384"/>' +
    '</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>'
  );

  function init() {
    const section = document.getElementById("text-mask-hero");
    const mask = document.getElementById("text-mask-mask");
    if (!section || !mask) return;

    mask.style.setProperty("--mask-image", `url(${JSON.stringify(MASK_FALLBACK)})`);

    if (typeof WikimediaImages !== "undefined") {
      WikimediaImages.fetchImage(MASK_SCIENTIFIC).then(({ url }) => {
        if (url && url !== WikimediaImages.FALLBACK_IMG) {
          mask.style.setProperty("--mask-image", `url(${JSON.stringify(url)})`);
        }
      });
    }

    let ticking = false;

    function update() {
      const rect = section.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const progress = total > 0 ? scrolled / total : 0;
      mask.style.setProperty("--progress", progress.toFixed(4));
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
