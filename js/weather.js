/**
 * 山の天気：①天気の良いエリアを探す → ②そのエリアのおすすめの山を選ぶ、の2段階で
 * 週末〜2週間先の山行計画を立てられるようにする。お気に入りの山はページ上部でウォッチできる。
 *
 * 予報は Open-Meteo（APIキー不要）から全山まとめて1回で取得する。
 * 日本の地形に強い気象庁モデル（MSM/GSM、約11日先まで）を優先し、
 * それ以降の日は ECMWF で補完して14日分にする。
 * 山ごとの「モデル比較」（気象庁・ECMWF・GFS・ICON）は、詳細を開いたときだけ追加取得する。
 */
(() => {
  const API = "https://api.open-meteo.com/v1/forecast";
  const DAYS = 14;
  const DAILY = "weather_code,precipitation_sum,wind_speed_10m_max,temperature_2m_max,temperature_2m_min";
  const PRIMARY = "jma_seamless";
  const FALLBACK = "ecmwf_ifs025";
  const COMPARE_MODELS = [
    { key: "jma_seamless", label: "気象庁" },
    { key: "ecmwf_ifs025", label: "ECMWF" },
    { key: "gfs_seamless", label: "GFS" },
    { key: "icon_seamless", label: "ICON" }
  ];
  const FAV_KEY = "yamabiyori:favorites";
  const CACHE_KEY = "yamabiyori:weather-cache";
  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

  const WEATHER = {
    0: ["☀️", "快晴", 0], 1: ["🌤️", "晴れ", 1], 2: ["⛅", "晴れ時々曇り", 2], 3: ["☁️", "曇り", 3],
    45: ["🌫️", "霧", 4], 48: ["🌫️", "霧氷", 4],
    51: ["🌦️", "霧雨", 4], 53: ["🌦️", "霧雨", 5], 55: ["🌦️", "強い霧雨", 5], 56: ["🌧️", "着氷性の霧雨", 5], 57: ["🌧️", "着氷性の霧雨", 5],
    61: ["🌧️", "小雨", 5], 63: ["🌧️", "雨", 6], 65: ["🌧️", "強い雨", 7], 66: ["🌨️", "着氷性の雨", 6], 67: ["🌨️", "着氷性の強い雨", 7],
    71: ["🌨️", "小雪", 5], 73: ["🌨️", "雪", 6], 75: ["❄️", "大雪", 7], 77: ["❄️", "霧雪", 5],
    80: ["🌦️", "にわか雨", 5], 81: ["🌧️", "にわか雨", 6], 82: ["⛈️", "激しいにわか雨", 7],
    85: ["🌨️", "にわか雪", 5], 86: ["❄️", "強いにわか雪", 6],
    95: ["⛈️", "雷雨", 8], 96: ["⛈️", "雷雨・雹", 9], 99: ["⛈️", "激しい雷雨・雹", 9]
  };

  const GRADES = [
    { max: 30, mark: "◎", label: "好天", color: "#4d7c62", tint: "#d9eadd" },
    { max: 70, mark: "○", label: "まずまず", color: "#6fa384", tint: "#e8f2eb" },
    { max: 120, mark: "△", label: "いまいち", color: "#c9a46b", tint: "#f6ecdb" },
    { max: Infinity, mark: "×", label: "荒れ模様", color: "#c98b83", tint: "#f5e1de" }
  ];
  const GOOD_DAY_MAX = 70;

  const state = {
    mountains: [],
    areas: [],
    japanMap: null,
    days: [],
    fc: new Map(),
    periods: {},
    period: "weekend1",
    area: null,
    areaPinned: false,
    favorites: loadFavorites(),
    compareCache: new Map()
  };
  const els = {};

  document.addEventListener("DOMContentLoaded", () => {
    els.status = document.getElementById("wx-status");
    els.updated = document.getElementById("wx-updated");
    els.refresh = document.getElementById("wx-refresh");
    els.periodChips = document.getElementById("wx-period");
    els.map = document.getElementById("wx-map");
    els.rank = document.getElementById("wx-area-rank");
    els.table = document.getElementById("wx-area-table");
    els.areaSection = document.getElementById("wx-area-section");
    els.areaTitle = document.getElementById("wx-area-title");
    els.areaNote = document.getElementById("wx-area-note");
    els.mtnList = document.getElementById("wx-mtn-list");
    els.favList = document.getElementById("wx-fav-list");
    els.favEmpty = document.getElementById("wx-fav-empty");
    if (!els.mtnList) return;

    els.refresh?.addEventListener("click", () => load());
    els.periodChips.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-period]");
      if (btn) setPeriod(btn.dataset.period);
    });
    els.table.addEventListener("click", (e) => {
      const head = e.target.closest("[data-day]");
      if (head) { setPeriod(`day:${head.dataset.day}`); return; }
      const row = e.target.closest("[data-area]");
      if (row) setArea(row.dataset.area, true);
    });
    els.rank.addEventListener("click", (e) => {
      const row = e.target.closest("[data-area]");
      if (row) setArea(row.dataset.area, true);
    });
    [els.mtnList, els.favList].forEach((list) => list.addEventListener("click", onMountainListClick));

    const linkedArea = new URLSearchParams(location.search).get("area");
    if (linkedArea) {
      state.area = linkedArea;
      state.areaPinned = true;
    }

    load();
  });

  /* ===== データ取得 ===== */
  async function load() {
    setStatus("予報を読み込み中…");
    try {
      const [mountains, areas, japanMap] = await Promise.all([
        getJSON("data/mountains.json"),
        getJSON("data/areas.json"),
        state.japanMap ? state.japanMap : getJSON("data/japan-outline.json")
      ]);
      state.mountains = mountains;
      state.areas = areas;
      state.japanMap = japanMap;
    } catch (err) {
      console.error(err);
      setStatus("ページのデータを読み込めませんでした。再読み込みしてください。", true);
      return;
    }

    try {
      const lats = state.mountains.map((m) => m.lat).join(",");
      const lons = state.mountains.map((m) => m.lon).join(",");
      const url = `${API}?latitude=${lats}&longitude=${lons}&daily=${DAILY}&timezone=Asia%2FTokyo&forecast_days=${DAYS}&models=${PRIMARY},${FALLBACK}`;
      const results = await getJSON(url);
      const list = Array.isArray(results) ? results : [results];
      state.days = list[0].daily.time;
      state.fc = new Map();
      state.mountains.forEach((m, i) => {
        const daily = list[i]?.daily;
        if (daily) state.fc.set(m.name, mergeModels(daily));
      });
      saveCache();
      setUpdated(new Date(), false);
      setStatus("");
    } catch (err) {
      console.error(err);
      if (restoreCache()) {
        setStatus("最新の予報を取得できなかったため、前回取得した予報を表示しています（電波のある場所で「更新」してください）。", true);
      } else {
        setStatus("天気予報を取得できませんでした。電波状況を確認して「更新」を押してください。", true);
        return;
      }
    }

    state.periods = buildPeriods(state.days);
    if (!state.periods[state.period]?.days.length && !state.period.startsWith("day:")) state.period = "weekend1";
    renderAll();
  }

  function getJSON(url) {
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
      return r.json();
    });
  }

  // 気象庁モデルを優先し、値が無い日（約11日目以降）は ECMWF で補完する
  function mergeModels(daily) {
    const fields = ["weather_code", "precipitation_sum", "wind_speed_10m_max", "temperature_2m_max", "temperature_2m_min"];
    const out = { source: [] };
    fields.forEach((f) => (out[f] = []));
    daily.time.forEach((_, d) => {
      const usePrimary = daily[`weather_code_${PRIMARY}`]?.[d] != null;
      const model = usePrimary ? PRIMARY : FALLBACK;
      out.source.push(usePrimary ? "jma" : "ecmwf");
      fields.forEach((f) => out[f].push(daily[`${f}_${model}`]?.[d] ?? null));
    });
    out.score = daily.time.map((_, d) => dayScore(out, d));
    return out;
  }

  function dayScore(fc, d) {
    const code = fc.weather_code[d];
    if (code == null) return null;
    let score = weatherInfo(code).severity * 20;
    score += (fc.precipitation_sum[d] || 0) * 2;
    const wind = fc.wind_speed_10m_max[d] || 0;
    if (wind >= 50) score += 25;
    else if (wind >= 30) score += 12;
    return score;
  }

  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        fetchedAt: Date.now(),
        days: state.days,
        fc: Object.fromEntries(state.fc)
      }));
    } catch (_) { /* 保存できなくても表示には影響しない */ }
  }

  function restoreCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!cached?.days?.length) return false;
      state.days = cached.days;
      state.fc = new Map(Object.entries(cached.fc));
      setUpdated(new Date(cached.fetchedAt), true);
      return true;
    } catch (_) {
      return false;
    }
  }

  /* ===== 期間 ===== */
  function buildPeriods(days) {
    const dows = days.map(dayOfWeek);
    const sat = dows.indexOf(6);
    const within = (arr) => arr.filter((i) => i >= 0 && i < days.length);
    let w1, w2;
    if (dows[0] === 0) {
      w1 = [0];
      w2 = within([sat, sat + 1]);
    } else {
      w1 = within([sat, sat + 1]);
      w2 = within([sat + 7, sat + 8]);
    }
    return {
      weekend1: { label: "今週末", days: w1 },
      weekend2: { label: "来週末", days: w2 },
      all: { label: `${days.length}日間`, days: days.map((_, i) => i) }
    };
  }

  function currentPeriod() {
    if (state.period.startsWith("day:")) {
      const d = Number(state.period.slice(4));
      return { key: state.period, label: dayLabel(d), days: [d], single: true };
    }
    return { key: state.period, ...state.periods[state.period] };
  }

  function setPeriod(key) {
    state.period = key;
    if (!state.areaPinned) state.area = null;
    renderAll();
  }

  function setArea(name, scroll) {
    state.area = name;
    state.areaPinned = true;
    renderAll();
    if (scroll) els.areaSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ===== スコア計算 ===== */
  function mean(arr) {
    const v = arr.filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }

  function mountainPeriodScore(name, days) {
    const fc = state.fc.get(name);
    return fc ? mean(days.map((d) => fc.score[d])) : null;
  }

  function areaMountains(area) {
    return state.mountains.filter((m) => m.area === area && state.fc.has(m.name));
  }

  function areaDayScore(area, d) {
    return mean(areaMountains(area).map((m) => state.fc.get(m.name).score[d]));
  }

  function areaPeriodScore(area, days) {
    return mean(days.map((d) => areaDayScore(area, d)));
  }

  // その日のエリア代表アイコン：スコアが中央値の山の天気
  function areaDayCode(area, d) {
    const scored = areaMountains(area)
      .map((m) => ({ s: state.fc.get(m.name).score[d], c: state.fc.get(m.name).weather_code[d] }))
      .filter((x) => x.s != null)
      .sort((a, b) => a.s - b.s);
    return scored.length ? scored[Math.floor((scored.length - 1) / 2)].c : null;
  }

  function goodDays(scoreFn, days) {
    return days.filter((d) => { const s = scoreFn(d); return s != null && s <= GOOD_DAY_MAX; }).length;
  }

  function rankedAreas(period) {
    return state.areas
      .map((a) => ({ ...a, score: areaPeriodScore(a.name, period.days) }))
      .filter((a) => a.score != null)
      .sort((a, b) => a.score - b.score);
  }

  /* ===== 描画 ===== */
  function renderAll() {
    const period = currentPeriod();
    const areas = rankedAreas(period);
    if (!areas.length) return;
    if (!state.area || !areas.some((a) => a.name === state.area)) state.area = areas[0].name;

    renderPeriodChips(period);
    renderMap(period, areas);
    renderRank(period, areas);
    renderTable(period, areas);
    renderAreaMountains(period);
    renderFavorites(period);
  }

  function renderPeriodChips(period) {
    const chips = ["weekend1", "weekend2", "all"].map((key) => {
      const p = state.periods[key];
      if (!p?.days.length) return "";
      const range = key === "all" ? "" : `<span class="wx-chip-sub">${rangeLabel(p.days)}</span>`;
      return `<button type="button" class="chip${period.key === key ? " is-active" : ""}" data-period="${key}">${p.label}${range}</button>`;
    });
    if (period.single) chips.push(`<button type="button" class="chip is-active" data-period="${period.key}">${period.label}</button>`);
    els.periodChips.innerHTML = chips.join("");
  }

  function renderMap(period, areas) {
    const svgNS = "http://www.w3.org/2000/svg";
    const map = state.japanMap;
    const svg = els.map;
    svg.innerHTML = "";
    svg.setAttribute("viewBox", map.viewBox.join(" "));
    const el = (tag, attrs, parent) => {
      const node = document.createElementNS(svgNS, tag);
      Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
      (parent || svg).appendChild(node);
      return node;
    };

    const land = el("g", {});
    Object.values(map.paths).forEach((d) => el("path", { d, class: "wx-map__land" }, land));

    const scoreOf = new Map(areas.map((a) => [a.name, a.score]));
    const W = 96, H = 52;
    const lines = el("g", {});
    const boxes = el("g", {});

    state.areas.forEach((a) => {
      const pts = areaMountains(a.name).map((m) => project(m.lat, m.lon));
      if (!pts.length) return;
      const cx = mean(pts.map((p) => p.x));
      const cy = mean(pts.map((p) => p.y));
      const score = scoreOf.get(a.name);
      const grade = gradeFor(score);
      const selected = a.name === state.area;
      const inside = Math.abs(cx - a.labelX) < W / 2 && Math.abs(cy - a.labelY) < H / 2;

      if (!inside) {
        el("line", { x1: cx, y1: cy, x2: a.labelX, y2: a.labelY, class: "wx-map__leader" }, lines);
        el("circle", { cx, cy, r: selected ? 6 : 4.5, fill: grade.color, stroke: "#fff", "stroke-width": 1.5 }, lines);
      }

      const g = el("g", {
        class: "wx-map__box" + (selected ? " is-selected" : ""),
        tabindex: 0, role: "button",
        "aria-label": `${a.name}：${grade.label}`
      }, boxes);
      el("rect", { x: a.labelX - W / 2, y: a.labelY - H / 2, width: W, height: H, rx: 10, fill: selected ? grade.tint : "#fff", stroke: grade.color, "stroke-width": selected ? 3.5 : 2 }, g);
      const name = el("text", { x: a.labelX, y: a.labelY - 8, class: "wx-map__name" }, g);
      name.textContent = a.short;
      const sub = el("text", { x: a.labelX, y: a.labelY + 16, class: "wx-map__sub" }, g);
      sub.textContent = `${periodIcons(period, (d) => areaDayCode(a.name, d))} ${grade.mark}`;

      const pick = () => setArea(a.name, true);
      g.addEventListener("click", pick);
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    });
  }

  function renderRank(period, areas) {
    els.rank.innerHTML = areas.map((a, i) => {
      const grade = gradeFor(a.score);
      const detail = period.days.length > 2
        ? `<span class="wx-rank__good">好天 ${goodDays((d) => areaDayScore(a.name, d), period.days)}日</span>`
        : `<span class="wx-rank__icons">${periodIcons(period, (d) => areaDayCode(a.name, d))}</span>`;
      return `
        <li>
          <button type="button" class="wx-rank__row${a.name === state.area ? " is-selected" : ""}" data-area="${esc(a.name)}">
            <span class="wx-rank__no">${i + 1}</span>
            <span class="wx-rank__name">${esc(a.name)}</span>
            ${detail}
            ${gradeBadge(grade)}
            <span class="wx-rank__go" aria-hidden="true">›</span>
          </button>
        </li>`;
    }).join("");
  }

  function renderTable(period, areas) {
    const inPeriod = new Set(period.days);
    const head = state.days.map((date, d) => {
      const dow = dayOfWeek(date);
      const cls = ["wx-th-day", dow === 6 ? "is-sat" : "", dow === 0 ? "is-sun" : "", inPeriod.has(d) ? "is-period" : ""].join(" ");
      return `<th scope="col" class="${cls}"><button type="button" data-day="${d}" title="${dayLabel(d)}の天気で並べる">${shortDate(date)}<span>${WEEKDAYS[dow]}</span></button></th>`;
    }).join("");
    const rows = areas.map((a) => {
      const cells = state.days.map((date, d) => {
        const score = areaDayScore(a.name, d);
        const grade = gradeFor(score);
        const code = areaDayCode(a.name, d);
        const dow = dayOfWeek(date);
        const cls = ["wx-td-day", inPeriod.has(d) ? "is-period" : "", dow === 0 || dow === 6 ? "is-weekend" : ""].join(" ");
        return `<td class="${cls}" style="background:${grade.tint}" title="${esc(a.name)} ${dayLabel(d)}：${grade.label}">${code == null ? "―" : weatherInfo(code).emoji}</td>`;
      }).join("");
      return `<tr data-area="${esc(a.name)}" class="${a.name === state.area ? "is-selected" : ""}"><th scope="row">${esc(a.short)}</th>${cells}</tr>`;
    }).join("");
    els.table.innerHTML = `<thead><tr><th scope="col" class="wx-th-corner">エリア</th>${head}</tr></thead><tbody>${rows}</tbody>`;
  }

  function renderAreaMountains(period) {
    const area = state.areas.find((a) => a.name === state.area);
    const ranked = areaMountains(state.area)
      .map((m) => ({ m, score: mountainPeriodScore(m.name, period.days) }))
      .sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity));
    els.areaTitle.textContent = area.name;
    els.areaNote.textContent = `${period.label}${period.days.length <= 2 && !period.single ? `（${rangeLabel(period.days)}）` : ""}の天気が良い順`;
    els.mtnList.innerHTML = ranked.map(({ m, score }, i) => mountainRow(m, score, period, { rank: i + 1, recommend: i < 3 && score != null && score <= GOOD_DAY_MAX })).join("");
  }

  function renderFavorites(period) {
    const favs = state.favorites.map((n) => state.mountains.find((m) => m.name === n)).filter(Boolean);
    els.favEmpty.hidden = favs.length > 0;
    els.favList.innerHTML = favs.map((m) => mountainRow(m, mountainPeriodScore(m.name, period.days), period, { showArea: true })).join("");
  }

  function mountainRow(m, score, period, opts = {}) {
    const fc = state.fc.get(m.name);
    const grade = gradeFor(score);
    const fav = state.favorites.includes(m.name);
    const inPeriod = new Set(period.days);
    const summary = period.days.length > 2
      ? `<span class="wx-mtn__good">好天 ${goodDays((d) => fc?.score[d], period.days)}日</span>`
      : `<span class="wx-mtn__icons">${periodIcons(period, (d) => fc?.weather_code[d])}</span>`;

    const strip = state.days.map((date, d) => {
      const code = fc?.weather_code[d];
      const dow = dayOfWeek(date);
      const cls = ["wx-day", dow === 0 || dow === 6 ? "is-weekend" : "", inPeriod.has(d) ? "is-period" : ""].join(" ");
      return `<div class="${cls}" title="${dayLabel(d)} ${code == null ? "" : weatherInfo(code).label}">
          <span class="wx-day__w">${d === 0 ? "今日" : WEEKDAYS[dow]}</span>
          <span class="wx-day__i">${code == null ? "―" : weatherInfo(code).emoji}</span>
          <span class="wx-day__dot" style="background:${gradeFor(fc?.score[d]).color}"></span>
        </div>`;
    }).join("");

    return `
      <article class="wx-mtn${opts.recommend ? " is-recommend" : ""}" data-name="${esc(m.name)}">
        <div class="wx-mtn__head">
          ${opts.rank ? `<span class="wx-mtn__rank">${opts.rank}</span>` : ""}
          <div class="wx-mtn__title">
            <h3 class="wx-mtn__name">${esc(m.name)}${opts.recommend ? `<span class="wx-badge">おすすめ</span>` : ""}</h3>
            <p class="wx-mtn__meta">${opts.showArea ? `${esc(m.area)} ・ ` : ""}標高${m.elevation.toLocaleString()}m ・ <a class="wx-mtn__flora" href="mountain.html?m=${encodeURIComponent(m.name)}">🌸 花とキノコ</a></p>
          </div>
          <div class="wx-mtn__summary">${summary}${gradeBadge(grade)}</div>
          <button type="button" class="wx-fav-btn${fav ? " is-on" : ""}" data-fav="${esc(m.name)}" aria-pressed="${fav}" aria-label="${fav ? "お気に入りから外す" : "お気に入りに追加してウォッチする"}">${fav ? "★" : "☆"}</button>
        </div>
        <div class="wx-strip">${strip}</div>
        <details class="wx-mtn__more">
          <summary>詳しい予報・天気モデルの比較</summary>
          ${detailTable(fc)}
          <button type="button" class="btn btn--ghost wx-compare-btn" data-compare="${esc(m.name)}">気象庁・ECMWF・GFS・ICONを比較する</button>
          <div class="wx-compare" data-compare-out="${esc(m.name)}"></div>
          <a class="wx-ext" href="https://yamap.com/search/mountains?query=${encodeURIComponent(m.name.replace(/（.*/, ""))}" target="_blank" rel="noopener">YAMAPで${esc(m.name.replace(/（.*/, ""))}の情報を見る →</a>
        </details>
      </article>`;
  }

  function detailTable(fc) {
    if (!fc) return "";
    const head = state.days.map((date, d) => `<th scope="col" class="${dayClass(date)}">${shortDate(date)}<span>${WEEKDAYS[dayOfWeek(date)]}${fc.source[d] === "ecmwf" ? "＊" : ""}</span></th>`).join("");
    const row = (label, fn) => `<tr><th scope="row">${label}</th>${state.days.map((_, d) => `<td>${fn(d)}</td>`).join("")}</tr>`;
    const hasEcmwf = fc.source.includes("ecmwf");
    return `
      <div class="wx-scroll">
        <table class="wx-detail">
          <thead><tr><th></th>${head}</tr></thead>
          <tbody>
            ${row("天気", (d) => fc.weather_code[d] == null ? "―" : `<span class="wx-ico" title="${weatherInfo(fc.weather_code[d]).label}">${weatherInfo(fc.weather_code[d]).emoji}</span>`)}
            ${row("気温", (d) => `<span class="t-max">${num(fc.temperature_2m_max[d])}</span><span class="t-min">${num(fc.temperature_2m_min[d])}</span>`)}
            ${row("降水", (d) => `${num(fc.precipitation_sum[d])}<small>mm</small>`)}
            ${row("風速", (d) => `${num(fc.wind_speed_10m_max[d])}<small>km/h</small>`)}
          </tbody>
        </table>
      </div>
      <p class="wx-note">山頂付近の予報（気温℃は最高／最低）。${hasEcmwf ? "＊の日は気象庁モデルの予報期間外のため ECMWF で補完しています。" : ""}</p>`;
  }

  /* ===== お気に入り・モデル比較 ===== */
  function onMountainListClick(e) {
    const favBtn = e.target.closest("[data-fav]");
    if (favBtn) { toggleFavorite(favBtn.dataset.fav); return; }
    const cmpBtn = e.target.closest("[data-compare]");
    if (cmpBtn) loadComparison(cmpBtn.dataset.compare, cmpBtn);
  }

  function toggleFavorite(name) {
    const i = state.favorites.indexOf(name);
    if (i === -1) state.favorites.push(name);
    else state.favorites.splice(i, 1);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(state.favorites)); } catch (_) { /* 保存不可でも今回の表示は続ける */ }

    const on = state.favorites.includes(name);
    document.querySelectorAll(`[data-fav="${CSS.escape(name)}"]`).forEach((b) => {
      b.classList.toggle("is-on", on);
      b.textContent = on ? "★" : "☆";
      b.setAttribute("aria-pressed", on);
      b.setAttribute("aria-label", on ? "お気に入りから外す" : "お気に入りに追加してウォッチする");
    });
    renderFavorites(currentPeriod());
  }

  function loadFavorites() {
    try {
      const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (_) {
      return [];
    }
  }

  async function loadComparison(name, btn) {
    const outs = document.querySelectorAll(`[data-compare-out="${CSS.escape(name)}"]`);
    const m = state.mountains.find((x) => x.name === name);
    if (!m) return;
    btn.disabled = true;
    outs.forEach((o) => (o.innerHTML = `<p class="wx-note">読み込み中…</p>`));
    try {
      let data = state.compareCache.get(name);
      if (!data) {
        const url = `${API}?latitude=${m.lat}&longitude=${m.lon}&daily=weather_code,temperature_2m_max&timezone=Asia%2FTokyo&forecast_days=${DAYS}&models=${COMPARE_MODELS.map((x) => x.key).join(",")}`;
        data = (await getJSON(url)).daily;
        state.compareCache.set(name, data);
      }
      outs.forEach((o) => (o.innerHTML = comparisonTable(data)));
      btn.hidden = true;
    } catch (err) {
      console.error(err);
      outs.forEach((o) => (o.innerHTML = `<p class="wx-note is-error">モデル比較を取得できませんでした。電波状況を確認してもう一度お試しください。</p>`));
      btn.disabled = false;
    }
  }

  function comparisonTable(daily) {
    const head = daily.time.map((date) => `<th scope="col" class="${dayClass(date)}">${shortDate(date)}<span>${WEEKDAYS[dayOfWeek(date)]}</span></th>`).join("");
    const rows = COMPARE_MODELS.map(({ key, label }) => {
      const cells = daily.time.map((_, d) => {
        const code = daily[`weather_code_${key}`]?.[d];
        const t = daily[`temperature_2m_max_${key}`]?.[d];
        return code == null
          ? `<td class="is-empty">―</td>`
          : `<td><span title="${weatherInfo(code).label}">${weatherInfo(code).emoji}</span><small>${num(t)}°</small></td>`;
      }).join("");
      return `<tr><th scope="row">${label}</th>${cells}</tr>`;
    }).join("");
    return `
      <div class="wx-scroll">
        <table class="wx-detail wx-detail--compare"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>
      </div>
      <p class="wx-note">各モデルの天気と最高気温。モデルによって予報が分かれる日は、天気が崩れる可能性も考えておきましょう。「―」はそのモデルの予報期間外です。</p>`;
  }

  /* ===== 表示用ユーティリティ ===== */
  function project(lat, lon) {
    const p = state.japanMap.projection;
    return {
      x: p.pad + (lon - p.lonMin) * p.cosFactor * p.scale + p.offX,
      y: p.pad + (p.latMax - lat) * p.scale + p.offY
    };
  }

  function weatherInfo(code) {
    const w = WEATHER[code];
    return w ? { emoji: w[0], label: w[1], severity: w[2] } : { emoji: "❓", label: "不明", severity: 3 };
  }

  function gradeFor(score) {
    if (score == null) return { mark: "―", label: "データなし", color: "#c9c3ba", tint: "#f3f0ec" };
    return GRADES.find((g) => score <= g.max);
  }

  function gradeBadge(grade) {
    return `<span class="wx-grade" style="--grade:${grade.color};--grade-tint:${grade.tint}">${grade.mark} ${grade.label}</span>`;
  }

  function periodIcons(period, codeFn) {
    return period.days.slice(0, 2).map((d) => {
      const c = codeFn(d);
      return c == null ? "―" : weatherInfo(c).emoji;
    }).join("");
  }

  function dayOfWeek(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }

  function shortDate(dateStr) {
    const [, mo, da] = dateStr.split("-");
    return `${Number(mo)}/${Number(da)}`;
  }

  function dayLabel(d) {
    const date = state.days[d];
    return date ? `${shortDate(date)}(${WEEKDAYS[dayOfWeek(date)]})` : "";
  }

  function rangeLabel(days) {
    if (!days.length) return "";
    const first = shortDate(state.days[days[0]]);
    const last = shortDate(state.days[days[days.length - 1]]);
    return days.length === 1 ? first : `${first}〜${last}`;
  }

  function dayClass(dateStr) {
    const dow = dayOfWeek(dateStr);
    return dow === 6 ? "is-sat" : dow === 0 ? "is-sun" : "";
  }

  function num(n) {
    return n == null || Number.isNaN(n) ? "―" : Math.round(n * 10) / 10;
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function setStatus(text, isError = false) {
    els.status.textContent = text;
    els.status.classList.toggle("is-error", isError);
    els.status.hidden = !text;
  }

  function setUpdated(date, cached) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const md = `${date.getMonth() + 1}/${date.getDate()}`;
    els.updated.textContent = `${cached ? "前回取得" : "最終更新"}: ${md} ${hh}:${mm}`;
  }
})();
