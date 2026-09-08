/**
 * トップページのファーストビュー用モザイク写真を Wikimedia Commons から取得して差し込む。
 */
(function () {
  async function loadHeroMosaic() {
    if (typeof WikimediaImages === "undefined") return;
    const imgs = document.querySelectorAll(".hero__tile img[data-hero-scientific]");
    if (!imgs.length) return;

    await Promise.all(Array.from(imgs).map(async img => {
      const scientific = img.dataset.heroScientific;
      try {
        const { url } = await WikimediaImages.fetchImage(scientific);
        img.src = url;
      } catch {
        img.src = WikimediaImages.FALLBACK_IMG;
      }
    }));
  }

  document.addEventListener("DOMContentLoaded", loadHeroMosaic);
})();
