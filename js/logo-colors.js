/**
 * ファビコンの色を一定間隔で切り替える（ロゴと同じ配色を順番に）。
 * 生成元：ロゴの「山」の字。視差効果を減らす設定の端末では切り替えない。
 */
(() => {
  const PALETTES = [["#ffffff","#1b1530","#435539","#662e81"],["#ff9ccb","#1b1530","#ffffff","#e6001f"],["#ffe600","#1b1530","#ff5a1f","#053eef"],["#053eef","#ffe600","#ffffff","#ff9ccb"],["#ff4b2b","#1b1530","#ffe600","#ffffff"],["#1fc44e","#1b1530","#ffffff","#ffe600"],["#d9b3ff","#e6001f","#1b1530","#1b1530"],["#3ee8f0","#1b1530","#e6001f","#053eef"]];
  const INTERVAL_MS = 2000;
  const D = "M149.8 55.4C141.7 55.4 136 50.6 125.8 50.6C119.9 50.6 116 53.6 111.6 53.6C109.4 53.6 106.5 52.1 106.5 48.6C106.5 43.8 111.6 38.1 111.6 30.4C111.6 25.5 109.4 20.2 105.6 17.7C111.6 17.9 120.8 16.1 124.2 15.1C122 17.8 118.9 23.4 118.9 28.9C118.9 33.5 120.3 37.9 123.4 37.9C127.8 37.9 129.3 31.9 129.3 23C129.3 10.8 123.8 6.4 115.7 2.8C123.9 2.3 134.7 0 142.7 0C146.7 0 149.9 .6 151.8 2.3C141.7 4.9 137.7 10.4 137.7 23.7C137.7 31.6 138.9 37.1 143.3 37.1C147.3 37.1 148 31 148 25.8C148 21.6 146.9 16.3 143.4 13.5C148.9 13 158.6 13.9 162.6 15.8C156.5 18.6 155.1 24 155.1 29C155.1 38.5 161.2 41.9 161.2 47.6C161.2 52 157.5 55.4 149.8 55.4Z";
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const icon = (p) => "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
    '<rect x="12" y="12" width="488" height="488" rx="110" fill="' + p[0] + '" stroke="#1b1530" stroke-width="24"/>' +
    '<g transform="translate(16 16)"><path fill="' + p[3] + '" transform="translate(-504 95) scale(5.6)" d="' + D + '"/></g>' +
    '<path fill="' + p[1] + '" transform="translate(-504 95) scale(5.6)" d="' + D + '"/></svg>');
  const urls = PALETTES.map(icon);

  function start() {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/svg+xml";
    let i = 0;
    setInterval(() => {
      if (document.hidden) return;
      i = (i + 1) % urls.length;
      link.href = urls[i];
    }, INTERVAL_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
