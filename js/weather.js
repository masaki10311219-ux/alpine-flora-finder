/**
 * 全国の主要山域の現在の天気を Open-Meteo API（無料・APIキー不要）から取得し、
 * 「今、晴れている（登山向きの）山域」が一目でわかるようにスコア順で並べる。
 */
(() => {
  const API_BASE = "https://api.open-meteo.com/v1/forecast";
  const CURRENT_FIELDS = "temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m";

  // WMO weather code -> 表示用の絵文字・ラベル・悪天候スコア（低いほど好天）
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

  const els = {};

  document.addEventListener("DOMContentLoaded", () => {
    els.grid = document.getElementById("weather-grid");
    els.updated = document.getElementById("weather-updated");
    els.refresh = document.getElementById("weather-refresh");
    els.status = document.getElementById("weather-status");

    if (!els.grid) return;

    els.refresh?.addEventListener("click", () => loadWeather());
    loadWeather();
  });

  function weatherInfo(code) {
    return WEATHER_CODE_MAP[code] || { emoji: "❓", label: "不明", severity: 3 };
  }

  function scoreOf(current) {
    const info = weatherInfo(current.weather_code);
    let score = info.severity * 20;
    score += (current.cloud_cover || 0) * 0.3;
    score += (current.precipitation || 0) * 15;
    if (current.wind_speed_10m >= 50) score += 25;
    else if (current.wind_speed_10m >= 30) score += 12;
    return score;
  }

  async function loadWeather() {
    setStatus("読み込み中…");
    els.grid.setAttribute("aria-busy", "true");

    try {
      const mountains = await fetch("data/mountains.json").then((r) => r.json());
      const lats = mountains.map((m) => m.lat).join(",");
      const lons = mountains.map((m) => m.lon).join(",");
      const url = `${API_BASE}?latitude=${lats}&longitude=${lons}&current=${CURRENT_FIELDS}&timezone=Asia%2FTokyo`;

      const results = await fetch(url).then((r) => {
        if (!r.ok) throw new Error(`weather API error: ${r.status}`);
        return r.json();
      });

      const entries = mountains.map((mountain, i) => {
        const current = results[i]?.current;
        return { mountain, current, score: current ? scoreOf(current) : Infinity };
      }).filter((e) => e.current);

      entries.sort((a, b) => a.score - b.score);
      render(entries);
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

  function render(entries) {
    els.grid.innerHTML = "";
    entries.forEach((entry, i) => {
      els.grid.appendChild(buildCard(entry, i));
    });
  }

  function buildCard({ mountain, current, score }, index) {
    const info = weatherInfo(current.weather_code);
    const isBest = index < 3;

    const card = document.createElement("article");
    card.className = "weather-card" + (isBest ? " weather-card--best" : "");

    const rankBadge = isBest
      ? `<span class="weather-card__badge">🌞 狙い目 No.${index + 1}</span>`
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
    `;
    return card;
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
