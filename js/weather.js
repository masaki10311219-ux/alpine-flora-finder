/**
 * 全国の主要山域の天気を Open-Meteo API（無料・APIキー不要）経由で
 * 気象庁のメソスケールモデル（MSM・5km解像度、4日先まで）＋全球モデル（GSM）を
 * シームレスに接続したデータ（models=jma_seamless）から取得し、
 * 1) 日本地図上にマーカーで「おすすめ山域」を表示
 * 2) 今／週末（次の土日）／週間（7日間平均）でランキング基準を切り替え
 * 3) 各山域カードに7日間の簡易予報ストリップを表示
 * することで、週末の登山計画に使えるようにする。
 * ※ JMAモデルは降水確率（precipitation_probability）を提供しないため、
 *   日別スコアには代わりに降水量合計（precipitation_sum）を使用する。
 */
(() => {
  const API_BASE = "https://api.open-meteo.com/v1/forecast";
  const WEATHER_MODEL = "jma_seamless";
  const CURRENT_FIELDS = "temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m";
  const DAILY_FIELDS = "weather_code,precipitation_sum,wind_speed_10m_max,temperature_2m_max,temperature_2m_min";
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
  let area = "all";
  let japanMap = null;

  document.addEventListener("DOMContentLoaded", () => {
    els.grid = document.getElementById("weather-grid");
    els.updated = document.getElementById("weather-updated");
    els.refresh = document.getElementById("weather-refresh");
    els.status = document.getElementById("weather-status");
    els.map = document.getElementById("weather-map");
    els.legend = document.getElementById("weather-map-legend");
    els.heading = document.getElementById("weather-recommend-heading");
    els.areaChips = document.getElementById("weather-area-chips");
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
    score += (daily.precipitation_sum[i] || 0) * 2;
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
      const [mountains, mapData] = await Promise.all([
        fetch("data/mountains.json").then((r) => r.json()),
        japanMap ? Promise.resolve(japanMap) : fetch("data/japan-outline.json").then((r) => r.json())
      ]);
      japanMap = mapData;
      renderAreaChips(mountains);

      const lats = mountains.map((m) => m.lat).join(",");
      const lons = mountains.map((m) => m.lon).join(",");
      const url = `${API_BASE}?latitude=${lats}&longitude=${lons}&current=${CURRENT_FIELDS}&daily=${DAILY_FIELDS}&timezone=Asia%2FTokyo&forecast_days=${FORECAST_DAYS}&models=${WEATHER_MODEL}`;

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

  function renderAreaChips(mountains) {
    if (!els.areaChips || els.areaChips.dataset.built) return;
    const areas = Array.from(new Set(mountains.map((m) => m.area)));
    els.areaChips.innerHTML = [
      `<button type="button" class="chip weather-area is-active" data-area="all">すべて</button>`,
      ...areas.map((a) => `<button type="button" class="chip weather-area" data-area="${escapeHTML(a)}">${escapeHTML(a)}</button>`)
    ].join("");
    els.areaChips.querySelectorAll(".weather-area").forEach((chip) => {
      chip.addEventListener("click", () => {
        area = chip.dataset.area;
        els.areaChips.querySelectorAll(".weather-area").forEach((c) => c.classList.toggle("is-active", c === chip));
        renderAll();
      });
    });
    els.areaChips.dataset.built = "1";
  }

  function renderAll() {
    if (!entries.length) return;
    const filtered = area === "all" ? entries : entries.filter((e) => e.mountain.area === area);
    const sorted = [...filtered].sort((a, b) => a.scores[mode] - b.scores[mode]);
    const areaLabel = area === "all" ? "" : `（${area}）`;
    if (els.heading) els.heading.textContent = `🗾 ${MODE_META[mode].heading}${areaLabel} TOP3`;
    renderMap(sorted);
    renderCards(sorted);
  }

  /* ===== 日本地図（Natural Earthの海岸線データを簡易投影） ===== */
  function project(lat, lon) {
    const p = japanMap.projection;
    const x = p.pad + (lon - p.lonMin) * p.cosFactor * p.scale + p.offX;
    const y = p.pad + (p.latMax - lat) * p.scale + p.offY;
    return { x, y };
  }

  function computeViewBox(filtered) {
    const full = japanMap.viewBox;
    if (area === "all" || !filtered.length) return full;

    const pts = filtered.map((e) => project(e.mountain.lat, e.mountain.lon));
    const MARGIN = 70, MIN_SIZE = 170;
    let minX = Math.min(...pts.map((p) => p.x)) - MARGIN;
    let maxX = Math.max(...pts.map((p) => p.x)) + MARGIN;
    let minY = Math.min(...pts.map((p) => p.y)) - MARGIN;
    let maxY = Math.max(...pts.map((p) => p.y)) + MARGIN;

    if (maxX - minX < MIN_SIZE) { const cx = (minX + maxX) / 2; minX = cx - MIN_SIZE / 2; maxX = cx + MIN_SIZE / 2; }
    if (maxY - minY < MIN_SIZE) { const cy = (minY + maxY) / 2; minY = cy - MIN_SIZE / 2; maxY = cy + MIN_SIZE / 2; }

    minX = Math.max(full[0], minX);
    minY = Math.max(full[1], minY);
    maxX = Math.min(full[0] + full[2], maxX);
    maxY = Math.min(full[1] + full[3], maxY);
    return [minX, minY, maxX - minX, maxY - minY];
  }

  function renderMap(sorted) {
    if (!els.map || !japanMap) return;
    const svgNS = "http://www.w3.org/2000/svg";
    els.map.innerHTML = "";
    els.map.setAttribute("viewBox", computeViewBox(sorted).join(" "));

    const landGroup = document.createElementNS(svgNS, "g");
    Object.values(japanMap.paths).forEach((d) => {
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", d);
      path.setAttribute("class", "weather-map__land");
      landGroup.appendChild(path);
    });
    els.map.appendChild(landGroup);

    const selectedNames = new Set(sorted.map((e) => e.mountain.name));
    const rankOf = new Map(sorted.map((e, i) => [e.mountain.name, i]));
    const labelCandidates = [];

    entries.forEach((entry) => {
      const { x, y } = project(entry.mountain.lat, entry.mountain.lon);
      const isSelected = area === "all" || selectedNames.has(entry.mountain.name);
      const band = bandFor(entry.scores[mode]);
      const rank = rankOf.get(entry.mountain.name);
      const isBest = isSelected && rank !== undefined && rank < 3;

      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("class", "weather-map__marker" + (isSelected ? "" : " weather-map__marker--dim"));
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", `${entry.mountain.name}（${isSelected ? band.label : "対象エリア外"}）`);

      const title = document.createElementNS(svgNS, "title");
      title.textContent = `${entry.mountain.name}（${entry.mountain.area}）${isSelected ? "・" + band.label : ""}`;
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
      dot.setAttribute("fill", isSelected ? band.color : "#c9c3ba");
      dot.setAttribute("stroke", "#fff");
      dot.setAttribute("stroke-width", "2");
      g.appendChild(dot);

      const showLabel = isBest || (area !== "all" && isSelected);
      if (showLabel) {
        labelCandidates.push({ x: x + 12, y, text: entry.mountain.name.replace(/（.*/, ""), isBest });
      }

      const activate = () => {
        if (!isSelected) {
          area = entry.mountain.area;
          els.areaChips?.querySelectorAll(".weather-area").forEach((c) => c.classList.toggle("is-active", c.dataset.area === area));
          renderAll();
        }
        focusCard(entry.mountain.name);
      };
      g.addEventListener("click", activate);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
      });

      els.map.appendChild(g);
    });

    renderLabels(labelCandidates, svgNS);
  }

  // ラベルが密集する場合に縦方向へずらして重なりを避ける
  function renderLabels(candidates, svgNS) {
    const MIN_GAP = 13;
    const sortedLabels = [...candidates].sort((a, b) => a.y - b.y);
    sortedLabels.forEach((label, i) => {
      if (i === 0) return;
      const prev = sortedLabels[i - 1];
      if (label.y - prev.y < MIN_GAP) label.y = prev.y + MIN_GAP;
    });

    const labelGroup = document.createElementNS(svgNS, "g");
    sortedLabels.forEach(({ x, y, text, isBest }) => {
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", x);
      label.setAttribute("y", y + 4);
      label.setAttribute("class", "weather-map__label" + (isBest ? " weather-map__label--best" : ""));
      label.textContent = text;
      labelGroup.appendChild(label);
    });
    els.map.appendChild(labelGroup);
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
