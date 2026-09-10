/**
 * 登山合コン・飲み会向けの話題カードゲーム。
 * data/topics.json からカテゴリー別にランダムに1枚引く。
 */
(() => {
  const CATEGORY_ORDER = ["定番", "山あるある", "深掘り", "恋愛トーク", "アイスブレイク"];

  const els = {
    filters: document.getElementById("topic-filters"),
    card: document.getElementById("topic-card"),
    badge: document.getElementById("topic-badge"),
    text: document.getElementById("topic-text"),
    drawBtn: document.getElementById("topic-draw")
  };

  let topics = [];
  let activeCategories = new Set(CATEGORY_ORDER);
  let lastId = null;

  function renderFilters() {
    els.filters.innerHTML = "";
    CATEGORY_ORDER.forEach(cat => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip topic-filter is-active";
      btn.dataset.category = cat;
      btn.textContent = cat;
      btn.addEventListener("click", () => {
        if (activeCategories.has(cat)) {
          if (activeCategories.size === 1) return; // 最低1カテゴリーは残す
          activeCategories.delete(cat);
          btn.classList.remove("is-active");
        } else {
          activeCategories.add(cat);
          btn.classList.add("is-active");
        }
      });
      els.filters.appendChild(btn);
    });
  }

  function drawCard() {
    const pool = topics.filter(t => activeCategories.has(t.category));
    if (!pool.length) return;

    let candidates = pool;
    if (pool.length > 1) {
      candidates = pool.filter(t => t.id !== lastId);
    }
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    lastId = picked.id;

    els.card.classList.remove("is-drawn");
    // reflow を挟んでアニメーションを再トリガー
    void els.card.offsetWidth;

    els.badge.textContent = picked.category;
    els.badge.className = `topic-card__badge topic-card__badge--${badgeClass(picked.category)}`;
    els.text.textContent = picked.text;
    els.card.classList.add("is-drawn");
  }

  function badgeClass(category) {
    const map = {
      "定番": "standard",
      "山あるある": "aruaru",
      "深掘り": "deep",
      "恋愛トーク": "love",
      "アイスブレイク": "ice"
    };
    return map[category] || "standard";
  }

  async function init() {
    const res = await fetch("data/topics.json");
    topics = await res.json();
    renderFilters();
    els.drawBtn.addEventListener("click", drawCard);
  }

  init();
})();
