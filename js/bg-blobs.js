/**
 * 全ページ共通のふわっと漂うグラデーション背景を挿入する。
 */
(() => {
  function init() {
    const wrap = document.createElement("div");
    wrap.className = "bg-blobs";
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML = `
      <span class="bg-blob bg-blob--a"></span>
      <span class="bg-blob bg-blob--b"></span>
      <span class="bg-blob bg-blob--c"></span>
      <span class="bg-blob bg-blob--d"></span>
    `;
    document.body.prepend(wrap);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
