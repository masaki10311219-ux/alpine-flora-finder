(() => {
  const COLOR_HEX = {
    "白": "#ffffff",
    "黄": "#f2c94c",
    "黄白": "#f5e6a8",
    "橙": "#e8871e",
    "ピンク": "#f1a7c2",
    "紅紫": "#b5487a",
    "淡紫": "#c9a8e0",
    "紫": "#8e5bb5",
    "青紫": "#6a5acd",
    "青": "#3b7dd8",
    "黒紫": "#4a2545"
  };

  // 濁音・半濁音・拗音・長音を含むカタカナをあ行〜わ行の代表行にまとめる
  const KANA_ROWS = [
    { label: "あ", chars: "アイウエオヴァィゥェォ" },
    { label: "か", chars: "カキクケコガギグゲゴ" },
    { label: "さ", chars: "サシスセソザジズゼゾ" },
    { label: "た", chars: "タチツテトダヂヅデドッ" },
    { label: "な", chars: "ナニヌネノ" },
    { label: "は", chars: "ハヒフヘホバビブベボパピプペポ" },
    { label: "ま", chars: "マミムメモ" },
    { label: "や", chars: "ヤユヨャュョ" },
    { label: "ら", chars: "ラリルレロ" },
    { label: "わ", chars: "ワヲンー" }
  ];

  function kanaRowOf(name) {
    const first = name.charAt(0);
    const row = KANA_ROWS.find(r => r.chars.includes(first));
    return row ? row.label : "他";
  }

  const state = {
    plants: [],
    query: "",
    months: new Set(),
    areas: new Set(),
    colors: new Set()
  };

  const els = {
    grid: document.getElementById("card-grid"),
    empty: document.getElementById("empty-state"),
    count: document.getElementById("results-count"),
    search: document.getElementById("name-search"),
    monthChips: document.getElementById("filter-months"),
    areaChips: document.getElementById("filter-areas"),
    colorChips: document.getElementById("filter-colors"),
    kanaIndex: document.getElementById("kana-index"),
    clearBtn: document.getElementById("clear-filters"),
    template: document.getElementById("card-template"),
    autoFilterNote: document.getElementById("auto-filter-note")
  };

  function uniqueSorted(values) {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, "ja"));
  }

  function buildAreaChips() {
    const areas = uniqueSorted(state.plants.flatMap(p => p.areas));
    els.areaChips.innerHTML = "";
    areas.forEach(area => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = area;
      btn.dataset.area = area;
      btn.addEventListener("click", () => {
        toggle(state.areas, area);
        btn.classList.toggle("is-active");
        render();
      });
      els.areaChips.appendChild(btn);
    });
  }

  function buildColorChips() {
    const colors = uniqueSorted(state.plants.flatMap(p => p.colors));
    els.colorChips.innerHTML = "";
    colors.forEach(color => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.dataset.color = color;
      const dot = document.createElement("span");
      dot.className = "color-dot";
      dot.style.background = COLOR_HEX[color] || "#ccc";
      btn.appendChild(dot);
      btn.appendChild(document.createTextNode(color));
      btn.addEventListener("click", () => {
        toggle(state.colors, color);
        btn.classList.toggle("is-active");
        render();
      });
      els.colorChips.appendChild(btn);
    });
  }

  function bindMonthChips() {
    els.monthChips.querySelectorAll(".chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const month = Number(btn.dataset.month);
        toggle(state.months, month);
        btn.classList.toggle("is-active");
        render();
      });
    });
  }

  function toggle(set, value) {
    if (set.has(value)) set.delete(value);
    else set.add(value);
  }

  function matches(plant) {
    if (state.query) {
      const q = state.query.trim().toLowerCase();
      const haystack = `${plant.name}${plant.kanji}${plant.scientific}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (state.months.size && !plant.months.some(m => state.months.has(m))) return false;
    if (state.areas.size && !plant.areas.some(a => state.areas.has(a))) return false;
    if (state.colors.size && !plant.colors.some(c => state.colors.has(c))) return false;
    return true;
  }

  function currentResults() {
    return state.plants
      .filter(matches)
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      observer.unobserve(img);
      loadImage(img);
    });
  }, { rootMargin: "200px" });

  async function loadImage(img) {
    const scientific = img.dataset.scientific;
    const { url, credit } = await WikimediaImages.fetchImage(scientific);
    img.src = url;
    const creditEl = img.parentElement.querySelector(".card__credit");
    if (credit) {
      creditEl.innerHTML = `<a href="${credit.pageUrl}" target="_blank" rel="noopener">© ${credit.artist} / Wikimedia Commons (${credit.license})</a>`;
    } else {
      creditEl.textContent = "";
    }
  }

  function renderCard(plant) {
    const node = els.template.content.cloneNode(true);
    const img = node.querySelector(".card__img");
    img.dataset.scientific = plant.scientific;
    img.alt = `${plant.name}（${plant.scientific}）の写真`;
    node.querySelector(".card__name").textContent = plant.name;
    node.querySelector(".card__kanji").textContent = plant.kanji ? `（${plant.kanji}）` : "";
    node.querySelector(".card__scientific").textContent = plant.scientific;
    node.querySelector(".card__desc").textContent = plant.desc;

    const tags = node.querySelector(".card__tags");
    const monthLabel = plant.months.length
      ? `${Math.min(...plant.months)}〜${Math.max(...plant.months)}月`
      : "";
    if (monthLabel) tags.appendChild(makeTag(monthLabel));
    plant.areas.forEach(a => tags.appendChild(makeTag(a)));
    plant.colors.forEach(c => tags.appendChild(makeTag(c)));

    const article = node.querySelector(".card");
    article.id = `plant-${plant.id}`;
    article.dataset.kanaRow = kanaRowOf(plant.name);

    observer.observe(img);
    return node;
  }

  function makeTag(text) {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = text;
    return span;
  }

  function renderKanaIndex(results) {
    const presentRows = new Set(results.map(p => kanaRowOf(p.name)));
    els.kanaIndex.innerHTML = "";
    KANA_ROWS.forEach(row => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = row.label;
      const has = presentRows.has(row.label);
      btn.disabled = !has;
      if (has) {
        btn.addEventListener("click", () => {
          const target = document.querySelector(`.card[data-kana-row="${row.label}"]`);
          if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      els.kanaIndex.appendChild(btn);
    });
  }

  function render() {
    const results = currentResults();
    els.grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    results.forEach(plant => frag.appendChild(renderCard(plant)));
    els.grid.appendChild(frag);

    els.empty.hidden = results.length !== 0;
    els.count.textContent = `${results.length}件 / 全${state.plants.length}種`;
    renderKanaIndex(results);
    updateAutoFilterNote();
  }

  function updateAutoFilterNote() {
    const currentMonth = new Date().getMonth() + 1;
    const isAutoMonthOnly =
      state.months.size === 1 &&
      state.months.has(currentMonth) &&
      !state.query && state.areas.size === 0 && state.colors.size === 0;

    els.autoFilterNote.hidden = !isAutoMonthOnly;
    if (isAutoMonthOnly) {
      els.autoFilterNote.textContent = `🌸 今（${currentMonth}月）に見られる花を優先表示中。他の花も見る場合は絞り込みをクリアしてください。`;
    }
  }

  function bindSearch() {
    let timer;
    els.search.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.query = els.search.value;
        render();
      }, 150);
    });
  }

  function bindClear() {
    els.clearBtn.addEventListener("click", () => {
      state.query = "";
      state.months.clear();
      state.areas.clear();
      state.colors.clear();
      els.search.value = "";
      document.querySelectorAll(".chip.is-active").forEach(c => c.classList.remove("is-active"));
      render();
    });
  }

  async function init() {
    const res = await fetch("data/plants.json");
    state.plants = await res.json();
    window.__PLANTS_DATA__ = state.plants;
    buildAreaChips();
    buildColorChips();
    bindMonthChips();
    bindSearch();
    bindClear();
    preselectCurrentMonth();
    render();
  }

  function preselectCurrentMonth() {
    const month = new Date().getMonth() + 1;
    const btn = els.monthChips.querySelector(`[data-month="${month}"]`);
    if (!btn) return;
    state.months.add(month);
    btn.classList.add("is-active");
  }

  init();
})();
