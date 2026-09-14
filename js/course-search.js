/**
 * 「コースタイム」「獲得標高」の上限で自前のコースデータを絞り込み、
 * 該当する山をYAMAPの山検索（https://yamap.com/search/mountains?query=...）に
 * リンクして詳細なルート・最新レポートを確認できるようにする。
 * ※ YAMAP自体を条件検索するAPIは公開されていないため、絞り込みはこのサイトの
 *   コースデータに対して行い、個々の山の詳細はYAMAP側で確認してもらう設計。
 */
(() => {
  const els = {};
  let courses = [];

  document.addEventListener("DOMContentLoaded", async () => {
    els.grid = document.getElementById("course-grid");
    els.count = document.getElementById("course-count");
    els.timeInput = document.getElementById("filter-time");
    els.timeValue = document.getElementById("filter-time-value");
    els.gainInput = document.getElementById("filter-gain");
    els.gainValue = document.getElementById("filter-gain-value");
    els.reset = document.getElementById("course-reset");

    if (!els.grid) return;

    try {
      courses = await fetch("data/courses.json").then((r) => r.json());
    } catch (err) {
      console.error(err);
      els.grid.innerHTML = `<p class="course-status course-status--error">コースデータの読み込みに失敗しました。再読み込みしてください。</p>`;
      return;
    }

    els.timeInput.addEventListener("input", () => { updateLabels(); render(); });
    els.gainInput.addEventListener("input", () => { updateLabels(); render(); });
    els.reset.addEventListener("click", () => {
      els.timeInput.value = els.timeInput.max;
      els.gainInput.value = els.gainInput.max;
      updateLabels();
      render();
    });

    updateLabels();
    render();
  });

  function updateLabels() {
    els.timeValue.textContent = `${els.timeInput.value}時間以内`;
    els.gainValue.textContent = `${Number(els.gainInput.value).toLocaleString()}m以下`;
  }

  function render() {
    const maxTime = Number(els.timeInput.value);
    const maxGain = Number(els.gainInput.value);

    const matched = courses
      .filter((c) => c.courseTimeHours <= maxTime && c.elevationGainM <= maxGain)
      .sort((a, b) => a.elevationGainM - b.elevationGainM);

    els.count.textContent = `${matched.length}件のコースが見つかりました`;
    els.grid.innerHTML = "";

    if (matched.length === 0) {
      els.grid.innerHTML = `<p class="course-status">条件に合うコースがありません。スライダーを右に動かして範囲を広げてみてください。</p>`;
      return;
    }

    matched.forEach((c) => els.grid.appendChild(buildCard(c)));
  }

  function buildCard(course) {
    const card = document.createElement("article");
    card.className = "course-card";

    const yamapUrl = `https://yamap.com/search/mountains?query=${encodeURIComponent(course.mountain)}`;

    card.innerHTML = `
      <h3 class="course-card__name">${escapeHTML(course.name)}</h3>
      <p class="course-card__area">${escapeHTML(course.area)}</p>
      <div class="course-card__stats">
        <div class="weather-stat">
          <span class="weather-stat__label">コースタイム</span>
          <span class="weather-stat__value">約${formatHours(course.courseTimeHours)}</span>
        </div>
        <div class="weather-stat">
          <span class="weather-stat__label">獲得標高</span>
          <span class="weather-stat__value">${course.elevationGainM.toLocaleString()}m</span>
        </div>
      </div>
      <a class="btn btn--ghost btn--full course-card__link" href="${yamapUrl}" target="_blank" rel="noopener">YAMAPで見る &rarr;</a>
    `;
    return card;
  }

  function formatHours(h) {
    return Number.isInteger(h) ? `${h}時間` : `${h}時間`;
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
