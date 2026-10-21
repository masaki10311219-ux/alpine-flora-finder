/**
 * 山の図鑑：山域と月を選ぶと、その山域で見られる高山植物・キノコを一覧表示する。
 * 行く前の予習用に図鑑として見られ、帰ってきたら「見た！」を付けて復習・記録できる。
 * 「見た！」の記録は種ごとに、このブラウザ（localStorage）にだけ保存し、写真のアップロードはしない。
 */
(() => {
  const SEEN_KEY = "yamabiyori:seen-v2";
  const OLD_SEEN_KEY = "yamabiyori:seen"; // 旧形式：{ 山名: { "plants:id": 日付 } }
  const FAV_KEY = "yamabiyori:favorites";
  const VIEW_KEY = "yamabiyori:guide-view";
  const MONTHS = [4, 5, 6, 7, 8, 9, 10, 11];
  const DEFAULT_AREA = "kita-alps";
  const TOXICITY = {
    deadly: { label: "猛毒", cls: "is-deadly" },
    toxic: { label: "毒", cls: "is-toxic" },
    edible: { label: "食用とされる", cls: "is-edible" }
  };

  const state = { data: null, area: null, month: "all", tab: "plants", filter: "all", query: "", view: loadView(), seen: loadSeen(), favAreas: new Set() };
  const els = {};

  document.addEventListener("DOMContentLoaded", async () => {
    ["mf-areas", "mf-fav-hint", "mf-months", "mf-summary", "mf-tabs", "mf-filter", "mf-search", "mf-view", "mf-list", "mf-empty", "mf-mushroom-warning", "mf-status"]
      .forEach((id) => (els[id.replace("mf-", "")] = document.getElementById(id)));

    try {
      state.data = await MountainFlora.load();
    } catch (err) {
      console.error(err);
      els.status.hidden = false;
      els.status.textContent = "図鑑データを読み込めませんでした。再読み込みしてください。";
      return;
    }

    const { areas, mountains } = state.data;
    const params = new URLSearchParams(location.search);
    const favMountains = loadFavorites().map((n) => mountains.find((m) => m.name === n)).filter(Boolean);
    favMountains.forEach((m) => { const a = MountainFlora.areaForMountain(areas, m); if (a) state.favAreas.add(a.id); });
    const fromMountain = MountainFlora.areaForMountain(areas, mountains.find((m) => m.name === params.get("m"))); // 旧URL ?m=山名
    const nowMonth = new Date().getMonth() + 1;

    state.area = MountainFlora.areaById(areas, params.get("a")) || fromMountain
      || MountainFlora.areaForMountain(areas, favMountains[0]) || MountainFlora.areaById(areas, DEFAULT_AREA);
    const monthParam = params.get("month");
    state.month = monthParam === "all" || MONTHS.includes(Number(monthParam)) ? monthParam : (MONTHS.includes(nowMonth) ? String(nowMonth) : "all");
    state.tab = params.get("tab") === "mushrooms" ? "mushrooms" : "plants";

    els["fav-hint"].hidden = state.favAreas.size === 0;

    els.areas.addEventListener("click", (e) => {
      const b = e.target.closest("[data-area]");
      if (b) { state.area = MountainFlora.areaById(areas, b.dataset.area); state.filter = "all"; render(); }
    });
    [els.months, els.empty].forEach((el) => el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-month]");
      if (b) { state.month = b.dataset.month; render(); }
    }));
    els.tabs.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { state.tab = b.dataset.tab; state.filter = "all"; render(); } });
    els.filter.addEventListener("click", (e) => { const b = e.target.closest("[data-filter]"); if (b) { state.filter = b.dataset.filter; render(); } });
    els.view.addEventListener("click", (e) => {
      const b = e.target.closest("[data-view]");
      if (!b) return;
      state.view = b.dataset.view;
      try { localStorage.setItem(VIEW_KEY, state.view); } catch (_) { /* 保存不可でも切り替えは効く */ }
      render();
    });
    els.search.addEventListener("input", () => { state.query = els.search.value.trim(); renderList(); });
    els.list.addEventListener("click", (e) => { const b = e.target.closest("[data-seen]"); if (b) toggleSeen(b.dataset.seen); });

    render();
  });

  /* ===== データ ===== */
  function entries(kind) {
    const list = kind === "plants"
      ? MountainFlora.plantsForArea(state.area, state.data.plants)
      : MountainFlora.mushroomsForArea(state.area, state.data.mushrooms);
    const inMonth = state.month === "all" ? list : list.filter((e) => e.item.months.includes(Number(state.month)));
    return inMonth.sort((a, b) => a.item.name.localeCompare(b.item.name, "ja"));
  }

  function seenKey(kind, id) {
    return `${kind}:${id}`;
  }

  function matchesQuery(item) {
    if (!state.query) return true;
    const q = toKatakana(state.query);
    return [item.name, item.kanji, item.scientific].some((v) => v && toKatakana(v).includes(q));
  }

  /* ===== 描画 ===== */
  function render() {
    const a = state.area;
    els.areas.innerHTML = state.data.areas.map((x) =>
      `<button type="button" class="chip${x.id === a.id ? " is-active" : ""}" data-area="${x.id}" aria-pressed="${x.id === a.id}">${state.favAreas.has(x.id) ? "★ " : ""}${esc(x.name)}</button>`
    ).join("");
    els.months.innerHTML = [...MONTHS.map(String), "all"].map((mo) =>
      `<button type="button" class="chip${state.month === mo ? " is-active" : ""}" data-month="${mo}">${mo === "all" ? "すべての月" : `${mo}月`}</button>`
    ).join("");

    const plants = entries("plants");
    const mushrooms = entries("mushrooms");
    const seenCount = (list, kind) => list.filter((e) => state.seen[seenKey(kind, e.item.id)]).length;
    const when = state.month === "all" ? "" : `${state.month}月に`;
    const mountainNames = a.mountains.map((m) => MountainFlora.shortName(m));
    const weatherArea = a.weatherAreas[0];

    els.summary.innerHTML = `
      <div class="mf-summary__head">
        <h2 class="mf-summary__name">${esc(a.name)}</h2>
        ${mountainNames.length ? `<p class="mf-summary__meta">主な山：${esc(mountainNames.join("・"))}</p>` : ""}
      </div>
      <p class="mf-summary__count">${when}見られる目安：🌸 高山植物 <strong>${plants.length}</strong>種 ・ 🍄 キノコ <strong>${mushrooms.length}</strong>種</p>
      <div class="mf-progress">
        ${progress("🌸 見た花", seenCount(plants, "plants"), plants.length)}
        ${progress("🍄 見たキノコ", seenCount(mushrooms, "mushrooms"), mushrooms.length)}
      </div>
      <div class="mf-summary__actions">
        ${plants.length ? `<a class="btn btn--cta" href="quiz.html?a=${encodeURIComponent(a.id)}">🌸 ${esc(a.name)}の花クイズ</a>` : ""}
        <a class="btn btn--ghost" href="weather.html?area=${encodeURIComponent(weatherArea)}">☀️ ${esc(a.name)}の天気</a>
      </div>`;

    els.tabs.innerHTML = [
      ["plants", `🌸 高山植物 ${plants.length}`],
      ["mushrooms", `🍄 キノコ ${mushrooms.length}`]
    ].map(([key, label]) => `<button type="button" role="tab" aria-selected="${state.tab === key}" class="mf-tab${state.tab === key ? " is-active" : ""}" data-tab="${key}">${label}</button>`).join("");

    els.filter.innerHTML = [["all", "すべて"], ["unseen", "まだ見ていない"], ["seen", "✓ 見た！"]]
      .map(([key, label]) => `<button type="button" class="chip${state.filter === key ? " is-active" : ""}" data-filter="${key}">${label}</button>`).join("");
    els.view.querySelectorAll("[data-view]").forEach((b) => {
      const on = b.dataset.view === state.view;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });

    els["mushroom-warning"].hidden = state.tab !== "mushrooms";
    state.lists = { plants, mushrooms };
    renderList();
    syncUrl();
  }

  function renderList() {
    const kind = state.tab;
    const list = state.lists[kind].filter((e) => {
      const isSeen = !!state.seen[seenKey(kind, e.item.id)];
      const byFilter = state.filter === "all" || (state.filter === "seen" ? isSeen : !isSeen);
      return byFilter && matchesQuery(e.item);
    });

    els.list.className = state.view === "cards" ? "mf-grid" : "mf-rows";
    const draw = state.view === "cards" ? card : row;
    els.list.innerHTML = list.map((e) => draw(kind, e, state.seen[seenKey(kind, e.item.id)])).join("");
    els.empty.hidden = list.length > 0;
    els.empty.innerHTML = emptyMessage(kind);
    lazyLoadImages();
  }

  function emptyMessage(kind) {
    if (state.query) return `「${esc(state.query)}」に一致するものはありません。`;
    if (state.filter === "seen") return "まだ「見た！」を付けたものはありません。山から帰ったら、出会えたものにチェックしてみましょう。";
    if (state.filter === "unseen") return "コンプリート！ この条件のものはすべて見ています。";
    const what = kind === "plants" ? "高山植物" : "キノコ";
    if (state.month !== "all") return `${state.month}月にこの山域で見られる${what}のデータはありません。<button type="button" class="chip" data-month="all">すべての月を見る</button>`;
    return `この山域の${what}のデータはまだ準備中です。`;
  }

  function progress(label, n, total) {
    const pct = total ? Math.round((n / total) * 100) : 0;
    return `<div class="mf-progress__item"><span>${label}</span><span class="mf-progress__bar"><span style="width:${pct}%"></span></span><span class="mf-progress__num">${n} / ${total}</span></div>`;
  }

  function monthStrip(kind, item) {
    const months = MONTHS.map((mo) => `<span class="${item.months.includes(mo) ? "is-on" : ""}${String(mo) === state.month ? " is-now" : ""}">${mo}</span>`).join("");
    return `<div class="mf-months" aria-label="${kind === "plants" ? "花期" : "発生時期"}">${months}</div>`;
  }

  function titleHtml(kind, item) {
    return kind === "plants"
      ? `<a href="plant.html?id=${encodeURIComponent(item.id)}">${esc(item.name)}</a>`
      : esc(item.name);
  }

  function toxBadge(kind, item) {
    return kind === "mushrooms" ? `<span class="mf-tox ${TOXICITY[item.toxicity].cls}">${TOXICITY[item.toxicity].label}</span>` : "";
  }

  function peaksHtml(peaks) {
    return peaks.length ? `<p class="mf-peaks">📍 ${esc(peaks.join("・"))}</p>` : "";
  }

  function lookalikes(item) {
    return item.lookalikes.length
      ? `<ul class="mf-card__alike">${item.lookalikes.map((l) => `<li>⚠ <strong>${esc(l.name)}</strong>に似ている：${esc(l.note)}</li>`).join("")}</ul>`
      : "";
  }

  function seenButton(key, seenDate) {
    return `<button type="button" class="mf-seen${seenDate ? " is-on" : ""}" data-seen="${esc(key)}" aria-pressed="${!!seenDate}">
            ${seenDate ? `✓ 見た！<small>${esc(formatDate(seenDate))}</small>` : "見た？"}
          </button>`;
  }

  // 一覧表示：小さな写真＋名前・説明・花期を1行に
  function row(kind, { item, peaks }, seenDate) {
    const key = seenKey(kind, item.id);
    const extra = kind === "mushrooms"
      ? `<p class="mf-card__habitat">📍 ${esc(item.habitat)}</p>${lookalikes(item)}`
      : peaksHtml(peaks);
    return `
      <article class="mf-row${seenDate ? " is-seen" : ""}">
        <div class="mf-row__thumb">
          <img alt="${esc(item.name)}の写真" data-scientific="${esc(item.scientific)}" src="${WikimediaImages.FALLBACK_IMG}">
        </div>
        <div class="mf-row__main">
          <h3 class="mf-row__name">${titleHtml(kind, item)} ${toxBadge(kind, item)}</h3>
          <p class="mf-row__sub">${esc([item.kanji, item.family].filter(Boolean).join(" ・ "))}</p>
          <p class="mf-row__desc">${esc(item.desc)}</p>
          ${monthStrip(kind, item)}
          ${extra}
          <p class="mf-row__credit"></p>
        </div>
        ${seenButton(key, seenDate)}
      </article>`;
  }

  // 写真カード表示
  function card(kind, { item, peaks }, seenDate) {
    const key = seenKey(kind, item.id);
    const extra = kind === "mushrooms" ? `<p class="mf-card__habitat">📍 ${esc(item.habitat)}</p>${lookalikes(item)}` : peaksHtml(peaks);
    return `
      <article class="mf-card${seenDate ? " is-seen" : ""}">
        <div class="mf-card__media">
          <img alt="${esc(item.name)}の写真" data-scientific="${esc(item.scientific)}" src="${WikimediaImages.FALLBACK_IMG}">
          ${toxBadge(kind, item)}
          <span class="mf-card__credit"></span>
        </div>
        <div class="mf-card__body">
          <h3 class="mf-card__name">${titleHtml(kind, item)}</h3>
          <p class="mf-card__sub">${esc([item.kanji, item.family].filter(Boolean).join(" ・ "))}</p>
          <p class="mf-card__sci">${esc(item.scientific)}</p>
          ${monthStrip(kind, item)}
          <p class="mf-card__desc">${esc(item.desc)}</p>
          ${extra}
          ${seenButton(key, seenDate)}
        </div>
      </article>`;
  }

  function toggleSeen(key) {
    const seen = { ...state.seen };
    if (seen[key]) delete seen[key];
    else seen[key] = new Date().toISOString().slice(0, 10);
    state.seen = seen;
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (_) { /* 保存不可でも表示は続ける */ }
    render();
  }

  function lazyLoadImages() {
    const imgs = els.list.querySelectorAll("img[data-scientific]");
    const load = (img) => {
      const sci = img.dataset.scientific;
      img.removeAttribute("data-scientific");
      WikimediaImages.fetchImage(sci).then(({ url, credit }) => {
        img.src = url;
        const holder = img.closest(".mf-card, .mf-row");
        const creditEl = holder && holder.querySelector(".mf-card__credit, .mf-row__credit");
        if (credit && creditEl) {
          creditEl.innerHTML = `📷 <a href="${esc(credit.pageUrl)}" target="_blank" rel="noopener">${esc(credit.artist)} / ${esc(credit.license)}</a>`;
        }
      });
    };
    if (!("IntersectionObserver" in window)) { imgs.forEach(load); return; }
    const io = new IntersectionObserver((list) => list.forEach((en) => {
      if (en.isIntersecting) { io.unobserve(en.target); load(en.target); }
    }), { rootMargin: "300px" });
    imgs.forEach((img) => io.observe(img));
  }

  function syncUrl() {
    const p = new URLSearchParams({ a: state.area.id, month: state.month });
    if (state.tab === "mushrooms") p.set("tab", "mushrooms");
    history.replaceState(null, "", `?${p}`);
    document.title = `${state.area.name}の花とキノコ | 山美和 -Yamabiyori-`;
  }

  /* ===== 保存データ ===== */
  // 「見た！」は種ごとに1つの記録。旧形式（山ごと）の記録があれば、いちばん古い日付でまとめて引き継ぐ
  function loadSeen() {
    try {
      const v2 = localStorage.getItem(SEEN_KEY);
      if (v2) return JSON.parse(v2) || {};
      const old = JSON.parse(localStorage.getItem(OLD_SEEN_KEY) || "{}") || {};
      const merged = {};
      Object.values(old).forEach((map) => Object.entries(map || {}).forEach(([k, d]) => {
        if (!merged[k] || d < merged[k]) merged[k] = d;
      }));
      if (Object.keys(merged).length) localStorage.setItem(SEEN_KEY, JSON.stringify(merged));
      return merged;
    } catch (_) {
      return {};
    }
  }

  function loadView() {
    try { return localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "list"; } catch (_) { return "list"; }
  }

  function loadFavorites() {
    try {
      const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (_) { return []; }
  }

  function toKatakana(str) {
    return String(str).replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  }

  function formatDate(iso) {
    const [y, mo, d] = iso.split("-").map(Number);
    return `${y}/${mo}/${d}`;
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
