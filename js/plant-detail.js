(() => {
  const els = {
    loading: document.getElementById("plant-loading"),
    notFound: document.getElementById("plant-not-found"),
    article: document.getElementById("plant-detail"),
    name: document.getElementById("plant-name"),
    kanji: document.getElementById("plant-kanji"),
    scientific: document.getElementById("plant-scientific"),
    photo: document.getElementById("plant-photo"),
    credit: document.getElementById("plant-credit"),
    specimenNo: document.getElementById("plant-specimen-no"),
    calloutSeason: document.getElementById("callout-season"),
    calloutColor: document.getElementById("callout-color"),
    calloutArea: document.getElementById("callout-area"),
    infoFamily: document.getElementById("info-family"),
    infoMonths: document.getElementById("info-months"),
    infoAreas: document.getElementById("info-areas"),
    infoPeaks: document.getElementById("info-peaks"),
    infoColors: document.getElementById("info-colors"),
    story: document.getElementById("plant-story"),
    mountains: document.getElementById("plant-mountains"),
    mountainsEmpty: document.getElementById("plant-mountains-empty")
  };

  function getPlantId() {
    return new URLSearchParams(location.search).get("id");
  }

  function monthLabel(months) {
    if (!months.length) return "不明";
    return `${Math.min(...months)}〜${Math.max(...months)}月`;
  }

  async function loadPlant() {
    const id = getPlantId();
    const res = await fetch("data/plants.json");
    const plants = await res.json();
    const index = plants.findIndex(p => p.id === id);

    if (index === -1) {
      els.loading.hidden = true;
      els.notFound.hidden = false;
      document.title = "見つかりませんでした | 山美和 -Yamabiyori-";
      return;
    }

    const plant = plants[index];
    renderPlant(plant, index);
    renderMountains(plant);
  }

  function renderPlant(plant, index) {
    document.title = `${plant.name}（${plant.kanji || plant.scientific}）| 山美和 -Yamabiyori-`;
    els.name.textContent = plant.name;
    els.kanji.textContent = plant.kanji ? `${plant.kanji} / ${plant.scientific}` : plant.scientific;
    els.scientific.textContent = plant.scientific;

    els.photo.alt = `${plant.name}（${plant.scientific}）の写真`;
    WikimediaImages.fetchImage(plant.scientific).then(({ url, credit }) => {
      els.photo.src = url;
      if (credit) {
        els.credit.innerHTML = `写真: <a href="${credit.pageUrl}" target="_blank" rel="noopener">${credit.artist} / Wikimedia Commons（${credit.license}）</a>`;
      }
    });

    els.specimenNo.textContent = `No.${String(index + 1).padStart(3, "0")}`;
    els.calloutSeason.textContent = `📅 ${monthLabel(plant.months)}`;
    els.calloutColor.textContent = `🎨 ${plant.colors.join("・")}`;
    els.calloutArea.textContent = `⛰️ ${plant.areas[0] || ""}`;

    els.infoFamily.textContent = plant.family;
    els.infoMonths.textContent = monthLabel(plant.months);
    els.infoAreas.textContent = plant.areas.join("、");
    els.infoPeaks.textContent = plant.peaks.length ? plant.peaks.join("、") : "特定の山は未登録";
    els.infoColors.textContent = plant.colors.join("、");

    els.story.textContent = plant.story || plant.desc;

    els.loading.hidden = true;
    els.article.hidden = false;
  }

  async function renderMountains(plant) {
    try {
      const { mountains } = await MountainFlora.load();
      const list = MountainFlora.mountainsForPlant(plant, mountains);
      els.mountainsEmpty.hidden = list.length > 0;
      els.mountains.innerHTML = list.map(({ mountain, here }) => {
        const a = document.createElement("a");
        a.className = "chip" + (here ? " is-here" : "");
        a.href = MountainFlora.pageUrl(mountain);
        a.textContent = here ? `★ ${mountain.name}` : mountain.name;
        a.title = here ? "代表的な自生地として知られる山" : `${mountain.area}のエリアで見られる目安`;
        return a.outerHTML;
      }).join("");
    } catch (err) {
      console.error(err);
      els.mountainsEmpty.hidden = false;
    }
  }

  loadPlant();
})();
