/**
 * 山の図鑑：登る山と月を選ぶと、その山で見られる高山植物・キノコを一覧表示する。
 * 行く前の予習用に図鑑として見られ、帰ってきたら「見た！」を付けて復習・記録できる。
 * 「見た！」の記録とお気に入りの山はこのブラウザ（localStorage）にだけ保存し、写真のアップロードはしない。
 */
(() => {
  const SEEN_KEY = "yamabiyori:seen";
  const FAV_KEY = "yamabiyori:favorites";
  const MONTHS = [4, 5, 6, 7, 8, 9, 10, 11];
  const DEFAULT_MOUNTAIN = "白馬岳";
  const TOXICITY = {
    deadly: { label: "猛毒", cls: "is-deadly" },
    toxic: { label: "毒", cls: "is-toxic" },
    edible: { label: "食用とされる", cls: "is-edible" }
  };

  const state = { data: null, mountain: null, month: "all", tab: "plants", filter: "all", seen: loadSeen() };
  const els = {};

  document.addEventListener("DOMContentLoaded", async () => {
    ["mf-mountain", "mf-months", "mf-quick", "mf-summary", "mf-tabs", "mf-filter", "mf-list", "mf-empty", "mf-mushroom-warning", "mf-status"]
      .forEach((id) => (els[id.replace("mf-", "")] = document.getElementById(id)));

    try {
      state.data = await MountainFlora.load();
    } catch (err) {
      console.error(err);
      els.status.hidden = false;
      els.status.textContent = "図鑑データを読み込めませんでした。再読み込みしてください。";
      return;
    }

    const params = new URLSearchParams(location.search);
    const favorites = loadFavorites();
    const nowMonth = new Date().getMonth() + 1;
    state.mountain = findMountain(params.get("m")) || findMountain(favorites[0]) || findMountain(DEFAULT_MOUNTAIN);
    state.month = params.get("month") || (MONTHS.includes(nowMonth) ? String(nowMonth) : "all");
    state.tab = params.get("tab") === "mushrooms" ? "mushrooms" : "plants";

    buildMountainSelect();
    buildQuick(favorites);

    els.mountain.addEventListener("change", () => { state.mountain = findMountain(els.mountain.value); state.filter = "all"; render(); });
    [els.months, els.empty].forEach((el) => el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-month]");
      if (b) { state.month = b.dataset.month; render(); }
    }));
    els.quick.addEventListener("click", (e) => { const b = e.target.closest("[data-m]"); if (b) { state.mountain = findMountain(b.dataset.m); state.filter = "all"; render(); } });
    els.tabs.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { state.tab = b.dataset.tab; state.filter = "all"; render(); } });
    els.filter.addEventListener("click", (e) => { const b = e.target.closest("[data-filter]"); if (b) { state.filter = b.dataset.filter; render(); } });
    els.list.addEventListener("click", (e) => { const b = e.target.closest("[data-seen]"); if (b) toggleSeen(b.dataset.seen); });

    render();
  });

  function findMountain(name) {
    return name ? state.data.mountains.find((m) => m.name === name) : null;
  }

  function buildMountainSelect() {
    const groups = new Map();
    state.data.mountains.forEach((m) => {
      if (!groups.has(m.area)) groups.set(m.area, []);
      groups.get(m.area).push(m);
    });
    els.mountain.innerHTML = [...groups].map(([area, list]) =>
      `<optgroup label="${esc(area)}">${list.map((m) => `<option value="${esc(m.name)}">${esc(m.name)}（${m.elevation.toLocaleString()}m）</option>`).join("")}</optgroup>`
    ).join("");
  }

  function buildQuick(favorites) {
    const favs = favorites.map(findMountain).filter(Boolean);
    if (!favs.length) { els.quick.hidden = true; return; }
    els.quick.innerHTML = `<span class="mf-quick__label">★お気に入り：</span>` +
      favs.map((m) => `<button type="button" class="chip" data-m="${esc(m.name)}">${esc(m.name)}</button>`).join("");
  }

  /* ===== 一覧 ===== */
  function entries(kind) {
    const m = state.mountain;
    const list = kind === "plants"
      ? MountainFlora.plantsFor(m, state.data.plants)
      : MountainFlora.mushroomsFor(m, state.data.mushrooms);
    const inMonth = state.month === "all" ? list : list.filter((e) => e.item.months.includes(Number(state.month)));
    return inMonth.sort((a, b) => Number(b.here) - Number(a.here));
  }

  function seenKey(kind, id) {
    return `${kind}:${id}`;
  }

  function seenMap() {
    return state.seen[state.mountain.name] || {};
  }

  function render() {
    const m = state.mountain;
    els.mountain.value = m.name;
    els.months.innerHTML = [...MONTHS.map(String), "all"].map((mo) =>
      `<button type="button" class="chip${state.month === mo ? " is-active" : ""}" data-month="${mo}">${mo === "all" ? "すべての月" : `${mo}月`}</button>`
    ).join("");
    els.quick.querySelectorAll("[data-m]").forEach((b) => b.classList.toggle("is-active", b.dataset.m === m.name));

    const plants = entries("plants");
    const mushrooms = entries("mushrooms");
    const seen = seenMap();
    const seenCount = (list, kind) => list.filter((e) => seen[seenKey(kind, e.item.id)]).length;
    const when = state.month === "all" ? "" : `${state.month}月に`;

    els.summary.innerHTML = `
      <div class="mf-summary__head">
        <h2 class="mf-summary__name">${esc(m.name)}</h2>
        <p class="mf-summary__meta">${esc(m.area)} ・ 標高${m.elevation.toLocaleString()}m</p>
      </div>
      <p class="mf-summary__count">${when}見られる目安：🌸 高山植物 <strong>${plants.length}</strong>種 ・ 🍄 キノコ <strong>${mushrooms.length}</strong>種</p>
      <div class="mf-progress">
        ${progress("🌸 見た花", seenCount(plants, "plants"), plants.length)}
        ${progress("🍄 見たキノコ", seenCount(mushrooms, "mushrooms"), mushrooms.length)}
      </div>
      <div class="mf-summary__actions">
        <a class="btn btn--cta" href="quiz.html?m=${encodeURIComponent(m.name)}">🌸 この山の花クイズで予習</a>
        <a class="btn btn--ghost" href="weather.html?area=${encodeURIComponent(m.area)}">☀️ ${esc(m.area)}の天気</a>
      </div>`;

    els.tabs.innerHTML = [
      ["plants", `🌸 高山植物 ${plants.length}`],
      ["mushrooms", `🍄 キノコ ${mushrooms.length}`]
    ].map(([key, label]) => `<button type="button" role="tab" aria-selected="${state.tab === key}" class="mf-tab${state.tab === key ? " is-active" : ""}" data-tab="${key}">${label}</button>`).join("");

    els.filter.innerHTML = [["all", "すべて"], ["unseen", "まだ見ていない"], ["seen", "✓ 見た！"]]
      .map(([key, label]) => `<button type="button" class="chip${state.filter === key ? " is-active" : ""}" data-filter="${key}">${label}</button>`).join("");

    els["mushroom-warning"].hidden = state.tab !== "mushrooms";

    const kind = state.tab;
    const list = (kind === "plants" ? plants : mushrooms).filter((e) => {
      const isSeen = !!seen[seenKey(kind, e.item.id)];
      return state.filter === "all" || (state.filter === "seen" ? isSeen : !isSeen);
    });

    els.list.innerHTML = list.map((e) => card(kind, e, seen[seenKey(kind, e.item.id)])).join("");
    els.empty.hidden = list.length > 0;
    els.empty.innerHTML = emptyMessage(kind);
    lazyLoadImages();
    syncUrl();
  }

  function emptyMessage(kind) {
    if (state.filter === "seen") return "まだ「見た！」を付けたものはありません。山から帰ったら、出会えたものにチェックしてみましょう。";
    if (state.filter === "unseen") return "コンプリート！ この条件のものはすべて見ています。";
    const what = kind === "plants" ? "高山植物" : "キノコ";
    if (state.month !== "all") return `${state.month}月にこの山で見られる${what}のデータはありません。<button type="button" class="chip" data-month="all">すべての月を見る</button>`;
    return `この山の${what}のデータはまだ準備中です。`;
  }

  function progress(label, n, total) {
    const pct = total ? Math.round((n / total) * 100) : 0;
    return `<div class="mf-progress__item"><span>${label}</span><span class="mf-progress__bar"><span style="width:${pct}%"></span></span><span class="mf-progress__num">${n} / ${total}</span></div>`;
  }

  function card(kind, { item, here }, seenDate) {
    const key = seenKey(kind, item.id);
    const months = MONTHS.map((mo) => `<span class="${item.months.includes(mo) ? "is-on" : ""}${String(mo) === state.month ? " is-now" : ""}">${mo}</span>`).join("");
    const title = kind === "plants"
      ? `<a href="plant.html?id=${encodeURIComponent(item.id)}">${esc(item.name)}</a>`
      : esc(item.name);
    const tox = kind === "mushrooms" ? `<span class="mf-tox ${TOXICITY[item.toxicity].cls}">${TOXICITY[item.toxicity].label}</span>` : "";
    const extra = kind === "mushrooms" ? `
        <p class="mf-card__habitat">📍 ${esc(item.habitat)}</p>
        ${item.lookalikes.length ? `<ul class="mf-card__alike">${item.lookalikes.map((l) => `<li>⚠ <strong>${esc(l.name)}</strong>に似ている：${esc(l.note)}</li>`).join("")}</ul>` : ""}` : "";

    return `
      <article class="mf-card${seenDate ? " is-seen" : ""}">
        <div class="mf-card__media">
          <img alt="${esc(item.name)}の写真" data-scientific="${esc(item.scientific)}" src="${WikimediaImages.FALLBACK_IMG}">
          ${here ? `<span class="mf-card__here">この山の記録あり</span>` : ""}
          ${tox}
          <span class="mf-card__credit"></span>
        </div>
        <div class="mf-card__body">
          <h3 class="mf-card__name">${title}</h3>
          <p class="mf-card__sub">${esc([item.kanji, item.family].filter(Boolean).join(" ・ "))}</p>
          <p class="mf-card__sci">${esc(item.scientific)}</p>
          <div class="mf-months" aria-label="${kind === "plants" ? "花期" : "発生時期"}">${months}</div>
          <p class="mf-card__desc">${esc(item.desc)}</p>
          ${extra}
          <button type="button" class="mf-seen${seenDate ? " is-on" : ""}" data-seen="${esc(key)}" aria-pressed="${!!seenDate}">
            ${seenDate ? `✓ 見た！<small>${esc(formatDate(seenDate))}</small>` : "見た？ タップで記録"}
          </button>
        </div>
      </article>`;
  }

  function toggleSeen(key) {
    const name = state.mountain.name;
    const map = { ...(state.seen[name] || {}) };
    if (map[key]) delete map[key];
    else map[key] = new Date().toISOString().slice(0, 10);
    state.seen = { ...state.seen, [name]: map };
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(state.seen)); } catch (_) { /* 保存不可でも表示は続ける */ }
    render();
  }

  function lazyLoadImages() {
    const imgs = els.list.querySelectorAll("img[data-scientific]");
    const load = (img) => {
      const sci = img.dataset.scientific;
      img.removeAttribute("data-scientific");
      WikimediaImages.fetchImage(sci).then(({ url, credit }) => {
        img.src = url;
        if (credit) {
          img.parentElement.querySelector(".mf-card__credit").innerHTML =
            `<a href="${esc(credit.pageUrl)}" target="_blank" rel="noopener">${esc(credit.artist)} / ${esc(credit.license)}</a>`;
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
    const p = new URLSearchParams({ m: state.mountain.name });
    if (state.month !== "all") p.set("month", state.month);
    if (state.tab === "mushrooms") p.set("tab", "mushrooms");
    history.replaceState(null, "", `?${p}`);
    document.title = `${state.mountain.name}の花とキノコ | 山美和 -Yamabiyori-`;
  }

  function loadSeen() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}") || {}; } catch (_) { return {}; }
  }

  function loadFavorites() {
    try {
      const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (_) { return []; }
  }

  function formatDate(iso) {
    const [y, mo, d] = iso.split("-").map(Number);
    return `${y}/${mo}/${d}`;
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
