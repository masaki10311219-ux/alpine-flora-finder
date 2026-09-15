/**
 * 全国の主要山域の天気を Open-Meteo API（無料・APIキー不要）から取得し、
 * 1) 日本地図上にマーカーで「おすすめ山域」を表示
 * 2) 今／週末（次の土日）／週間（7日間平均）でランキング基準を切り替え
 * 3) 各山域カードに7日間の簡易予報ストリップを表示
 * することで、週末の登山計画に使えるようにする。
 */
(() => {
  const API_BASE = "https://api.open-meteo.com/v1/forecast";
  const CURRENT_FIELDS = "temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m";
  const DAILY_FIELDS = "weather_code,precipitation_probability_max,wind_speed_10m_max,temperature_2m_max,temperature_2m_min";
  const FORECAST_DAYS = 7;
  const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

  const WEATHER_CODE_MAP = {
    0: { emoji: "☀️", label: "快晴", severity: 0 },
    1: { emoji: "🌤️", label: "ほぼ晴れ", severity: 1 },
    2: { emoji: "⛅", label: "晴れ時々曇り", severity: 2 },
    3: { emoji: "☁️", label: "曇り", severity: 3 },
    45: { emoji: "🌫️", label: "霧", severity: 4 },
    48: { emoji: "🌫️", label: "霧氷", severity: 4 },
    51: { emoji: "🌦️", label: "霧雨（弱い）", severity: 4 },
    53: { emoji: "🌦️", label: "霧雨", severity: 5 },
    55: { emoji: "🌦️", label: "霧雨（強い）", severity: 5 },
    56: { emoji: "🌧️", label: "着氷性の霧雨", severity: 5 },
    57: { emoji: "🌧️", label: "着氷性の霧雨（強い）", severity: 5 },
    61: { emoji: "🌧️", label: "雨（弱い）", severity: 5 },
    63: { emoji: "🌧️", label: "雨", severity: 6 },
    65: { emoji: "🌧️", label: "雨（強い）", severity: 7 },
    66: { emoji: "🌨️", label: "着氷性の雨", severity: 6 },
    67: { emoji: "🌨️", label: "着氷性の雨（強い）", severity: 7 },
    71: { emoji: "🌨️", label: "雪（弱い）", severity: 5 },
    73: { emoji: "🌨️", label: "雪", severity: 6 },
    75: { emoji: "❄️", label: "雪（強い）", severity: 7 },
    77: { emoji: "❄️", label: "霧雪", severity: 5 },
    80: { emoji: "🌦️", label: "にわか雨（弱い）", severity: 5 },
    81: { emoji: "🌧️", label: "にわか雨", severity: 6 },
    82: { emoji: "⛈️", label: "にわか雨（激しい）", severity: 7 },
    85: { emoji: "🌨️", label: "にわか雪（弱い）", severity: 5 },
    86: { emoji: "❄️", label: "にわか雪（強い）", severity: 6 },
    95: { emoji: "⛈️", label: "雷雨", severity: 8 },
    96: { emoji: "⛈️", label: "雷雨（雹を伴う）", severity: 9 },
    99: { emoji: "⛈️", label: "雷雨（雹・激しい）", severity: 9 }
  };

  const MODE_META = {
    now: { label: "今", badgeIcon: "🌞", badgeText: "狙い目", heading: "今のおすすめ山域" },
    weekend: { label: "週末", badgeIcon: "🏕️", badgeText: "週末おすすめ", heading: "今週末のおすすめ山域" },
    week: { label: "週間", badgeIcon: "📅", badgeText: "週間おすすめ", heading: "今週のおすすめ山域" }
  };

  const SCORE_BANDS = [
    { max: 30, color: "#4d7c62", label: "最高" },
    { max: 70, color: "#6fa384", label: "良い" },
    { max: 120, color: "#e7c79c", label: "普通" },
    { max: Infinity, color: "#c98b83", label: "荒れ模様" }
  ];

  const els = {};
  let entries = [];
  let mode = "now";

  document.addEventListener("DOMContentLoaded", () => {
    els.grid = document.getElementById("weather-grid");
    els.updated = document.getElementById("weather-updated");
    els.refresh = document.getElementById("weather-refresh");
    els.status = document.getElementById("weather-status");
    els.map = document.getElementById("weather-map");
    els.legend = document.getElementById("weather-map-legend");
    els.heading = document.getElementById("weather-recommend-heading");
    els.modeChips = document.querySelectorAll(".weather-mode");

    if (!els.grid) return;

    els.refresh?.addEventListener("click", () => loadWeather());
    els.modeChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        mode = chip.dataset.mode;
        els.modeChips.forEach((c) => c.classList.toggle("is-active", c === chip));
        renderAll();
      });
    });

    renderLegend();
    loadWeather();
  });

  function weatherInfo(code) {
    return WEATHER_CODE_MAP[code] || { emoji: "❓", label: "不明", severity: 3 };
  }

  function scoreFromCurrent(current) {
    const info = weatherInfo(current.weather_code);
    let score = info.severity * 20;
    score += (current.cloud_cover || 0) * 0.3;
    score += (current.precipitation || 0) * 15;
    if (current.wind_speed_10m >= 50) score += 25;
    else if (current.wind_speed_10m >= 30) score += 12;
    return score;
  }

  function scoreFromDaily(daily, i) {
    const info = weatherInfo(daily.weather_code[i]);
    let score = info.severity * 20;
    score += (daily.precipitation_probability_max[i] || 0) * 0.6;
    const wind = daily.wind_speed_10m_max[i];
    if (wind >= 50) score += 25;
    else if (wind >= 30) score += 12;
    return score;
  }

  function dayOfWeek(dateStr) {
    return new Date(`${dateStr}T00:00:00+09:00`).getDay();
  }

  function bandFor(score) {
    return SCORE_BANDS.find((b) => score <= b.max);
  }

  async function loadWeather() {
    setStatus("読み込み中…");
    els.grid.setAttribute("aria-busy", "true");

    try {
      const mountains = await fetch("data/mountains.json").then((r) => r.json());
      const lats = mountains.map((m) => m.lat).join(",");
      const lons = mountains.map((m) => m.lon).join(",");
      const url = `${API_BASE}?latitude=${lats}&longitude=${lons}&current=${CURRENT_FIELDS}&daily=${DAILY_FIELDS}&timezone=Asia%2FTokyo&forecast_days=${FORECAST_DAYS}`;

      const results = await fetch(url).then((r) => {
        if (!r.ok) throw new Error(`weather API error: ${r.status}`);
        return r.json();
      });

      entries = mountains.map((mountain, i) => {
        const current = results[i]?.current;
        const daily = results[i]?.daily;
        if (!current || !daily) return null;

        const dailyScores = daily.time.map((_, di) => scoreFromDaily(daily, di));
        const weekendIdx = daily.time
          .map((d, di) => ({ di, dow: dayOfWeek(d) }))
          .filter((d) => d.dow === 0 || d.dow === 6)
          .map((d) => d.di);
        const weekendScore = weekendIdx.length
          ? weekendIdx.reduce((sum, di) => sum + dailyScores[di], 0) / weekendIdx.length
          : dailyScores[0];
        const weekScore = dailyScores.reduce((sum, s) => sum + s, 0) / dailyScores.length;

        return {
          mountain,
          current,
          daily,
          dailyScores,
          scores: { now: scoreFromCurrent(current), weekend: weekendScore, week: weekScore }
        };
      }).filter(Boolean);

      renderAll();
      setStatus("");

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      if (els.updated) els.updated.textContent = `最終更新: ${hh}:${mm}`;
    } catch (err) {
      console.error(err);
      setStatus("天気データの取得に失敗しました。電波状況を確認して再読み込みしてください。", true);
    } finally {
      els.grid.removeAttribute("aria-busy");
    }
  }

  function setStatus(text, isError = false) {
    if (!els.status) return;
    els.status.textContent = text;
    els.status.classList.toggle("weather-status--error", isError);
    els.status.hidden = !text;
  }

  function renderAll() {
    if (!entries.length) return;
    const sorted = [...entries].sort((a, b) => a.scores[mode] - b.scores[mode]);
    if (els.heading) els.heading.textContent = `🗾 ${MODE_META[mode].heading} TOP3`;
    renderMap(sorted);
    renderCards(sorted);
  }

  /* ===== 日本地図（緯度経度を単純投影したスキャッターマップ） ===== */
  function projection(mountains) {
    const lats = mountains.map((m) => m.lat);
    const lons = mountains.map((m) => m.lon);
    const latMin = Math.min(...lats), latMax = Math.max(...lats);
    const lonMin = Math.min(...lons), lonMax = Math.max(...lons);
    const meanLat = (latMin + latMax) / 2;
    const cosFactor = Math.cos((meanLat * Math.PI) / 180);

    const W = 560, H = 640, PAD = 60;
    const spanLat = latMax - latMin || 1;
    const spanLonAdj = (lonMax - lonMin) * cosFactor || 1;
    const scale = Math.min((W - PAD * 2) / spanLonAdj, (H - PAD * 2) / spanLat);

    return (lat, lon) => {
      const x = PAD + ((lon - lonMin) * cosFactor) * scale + (W - PAD * 2 - spanLonAdj * scale) / 2;
      const y = PAD + (latMax - lat) * scale + (H - PAD * 2 - spanLat * scale) / 2;
      return { x, y };
    };
  }

  function renderMap(sorted) {
    if (!els.map) return;
    const mountains = entries.map((e) => e.mountain);
    const project = projection(mountains);

    const svgNS = "http://www.w3.org/2000/svg";
    els.map.innerHTML = "";
    els.map.setAttribute("viewBox", "0 0 560 640");

    // 装飾用のふわっとした島影（正確な海岸線ではなく雰囲気を出すための背景ブロブ）
    const islandBlobs = [
      { cx: 430, cy: 90, rx: 90, ry: 70, rot: -20 },
      { cx: 260, cy: 320, rx: 60, ry: 230, rot: 24 },
      { cx: 130, cy: 560, rx: 55, ry: 70, rot: -10 },
      { cx: 90, cy: 480, rx: 30, ry: 40, rot: 10 }
    ];
    const blobGroup = document.createElementNS(svgNS, "g");
    blobGroup.setAttribute("opacity", "0.35");
    islandBlobs.forEach((b) => {
      const el = document.createElementNS(svgNS, "ellipse");
      el.setAttribute("cx", b.cx);
      el.setAttribute("cy", b.cy);
      el.setAttribute("rx", b.rx);
      el.setAttribute("ry", b.ry);
      el.setAttribute("transform", `rotate(${b.rot} ${b.cx} ${b.cy})`);
      el.setAttribute("fill", "var(--green-100)");
      blobGroup.appendChild(el);
    });
    els.map.appendChild(blobGroup);

    const rankOf = new Map(sorted.map((e, i) => [e.mountain.name, i]));

    entries.forEach((entry) => {
      const { x, y } = project(entry.mountain.lat, entry.mountain.lon);
      const score = entry.scores[mode];
      const band = bandFor(score);
      const rank = rankOf.get(entry.mountain.name);
      const isBest = rank < 3;

      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("class", "weather-map__marker");
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", `${entry.mountain.name}（${band.label}）`);

      const title = document.createElementNS(svgNS, "title");
      title.textContent = `${entry.mountain.name}（${band.label}）`;
      g.appendChild(title);

      if (isBest) {
        const ring = document.createElementNS(svgNS, "circle");
        ring.setAttribute("cx", x);
        ring.setAttribute("cy", y);
        ring.setAttribute("r", 13);
        ring.setAttribute("class", "weather-map__ring");
        g.appendChild(ring);
      }

      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", y);
      dot.setAttribute("r", isBest ? 8 : 6);
      dot.setAttribute("fill", band.color);
      dot.setAttribute("stroke", "#fff");
      dot.setAttribute("stroke-width", "2");
      g.appendChild(dot);

      if (isBest) {
        const label = document.createElementNS(svgNS, "text");
        label.setAttribute("x", x + 12);
        label.setAttribute("y", y + 4);
        label.setAttribute("class", "weather-map__label weather-map__label--best");
        label.textContent = entry.mountain.name.replace(/（.*/, "");
        g.appendChild(label);
      }

      g.addEventListener("click", () => focusCard(entry.mountain.name));
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); focusCard(entry.mountain.name); }
      });

      els.map.appendChild(g);
    });
  }

  function focusCard(name) {
    const card = els.grid.querySelector(`[data-mountain-name="${CSS.escape(name)}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("is-highlighted");
    setTimeout(() => card.classList.remove("is-highlighted"), 1600);
  }

  function renderLegend() {
    if (!els.legend) return;
    els.legend.innerHTML = SCORE_BANDS.map(
      (b) => `<li><span class="weather-map-legend__dot" style="background:${b.color}"></span>${b.label}</li>`
    ).join("");
  }

  /* ===== カード一覧 ===== */
  function renderCards(sorted) {
    els.grid.innerHTML = "";
    sorted.forEach((entry, i) => els.grid.appendChild(buildCard(entry, i)));
  }

  function buildCard(entry, index) {
    const { mountain, current, daily, dailyScores } = entry;
    const info = weatherInfo(current.weather_code);
    const isBest = index < 3;
    const meta = MODE_META[mode];

    const card = document.createElement("article");
    card.className = "weather-card" + (isBest ? " weather-card--best" : "");
    card.dataset.mountainName = mountain.name;

    const rankBadge = isBest
      ? `<span class="weather-card__badge">${meta.badgeIcon} ${meta.badgeText} No.${index + 1}</span>`
      : "";

    card.innerHTML = `
      ${rankBadge}
      <div class="weather-card__top">
        <span class="weather-card__icon" aria-hidden="true">${info.emoji}</span>
        <div>
          <h3 class="weather-card__name">${escapeHTML(mountain.name)}</h3>
          <p class="weather-card__meta">${escapeHTML(mountain.area)} ・ 標高${mountain.elevation.toLocaleString()}m</p>
        </div>
      </div>
      <p class="weather-card__condition">${escapeHTML(info.label)}</p>
      <div class="weather-card__stats">
        <div class="weather-stat">
          <span class="weather-stat__label">気温</span>
          <span class="weather-stat__value">${formatNum(current.temperature_2m)}℃</span>
        </div>
        <div class="weather-stat">
          <span class="weather-stat__label">風速</span>
          <span class="weather-stat__value">${formatNum(current.wind_speed_10m)}km/h</span>
        </div>
        <div class="weather-stat">
          <span class="weather-stat__label">雲量</span>
          <span class="weather-stat__value">${formatNum(current.cloud_cover)}%</span>
        </div>
        <div class="weather-stat">
          <span class="weather-stat__label">降水量</span>
          <span class="weather-stat__value">${formatNum(current.precipitation)}mm</span>
        </div>
      </div>
      <div class="weather-forecast-strip">${buildForecastStrip(daily, dailyScores)}</div>
    `;
    return card;
  }

  function buildForecastStrip(daily, dailyScores) {
    return daily.time.map((dateStr, i) => {
      const dow = dayOfWeek(dateStr);
      const isWeekend = dow === 0 || dow === 6;
      const isToday = i === 0;
      const info = weatherInfo(daily.weather_code[i]);
      const band = bandFor(dailyScores[i]);
      const classes = ["weather-forecast-day"];
      if (isWeekend) classes.push("weather-forecast-day--weekend");
      if (isToday) classes.push("weather-forecast-day--today");
      return `
        <div class="${classes.join(" ")}" title="${escapeHTML(info.label)}">
          <span class="weather-forecast-day__label">${isToday ? "今日" : WEEKDAY_LABELS[dow]}</span>
          <span class="weather-forecast-day__icon">${info.emoji}</span>
          <span class="weather-forecast-day__dot" style="background:${band.color}"></span>
        </div>
      `;
    }).join("");
  }

  function formatNum(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return "―";
    return Math.round(n * 10) / 10;
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
