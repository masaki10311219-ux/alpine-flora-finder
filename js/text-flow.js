/**
 * data-flow を付けた見出し要素の文字を1字ずつ span.char で包み、
 * ページ表示時に少しずつ流れるように現れるアニメーションを付与する。
 */
(function () {
  function wrapNode(el) {
    const original = Array.from(el.childNodes);
    el.innerHTML = "";
    let i = 0;
    original.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        for (const ch of node.textContent) {
          const span = document.createElement("span");
          span.className = "char";
          span.textContent = ch;
          span.style.transitionDelay = (i * 0.035).toFixed(2) + "s";
          el.appendChild(span);
          i++;
        }
      } else {
        el.appendChild(node.cloneNode(true));
      }
    });
  }

  function init() {
    const elements = document.querySelectorAll("[data-flow]");
    if (!elements.length) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    elements.forEach(wrapNode);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => document.body.classList.add("is-flow-in"));
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
