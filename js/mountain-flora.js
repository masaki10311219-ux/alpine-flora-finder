/**
 * 山域と、そこで見られる高山植物・キノコを結びつける共通モジュール。
 * 山の図鑑ページ・クイズ・植物の詳細ページから使う。
 *
 * 植物データの分布は「北アルプス」などの山域単位なので、図鑑も山域単位で見せる。
 * 山域の区分は植物データのエリアに合わせ、天気ページの山域（data/mountains.json の area）とも対応づける。
 * 高山植物：植物データの areas が山域に含まれるか、peaks（代表的な自生地）がその山域の山に一致すれば表示。
 * キノコ：分布の目安（range）と、山域にある山の標高から判定する。
 */
const MountainFlora = (() => {
  // 図鑑の山域（北から順）。plantAreas＝植物データのエリア、weatherAreas＝天気ページの山域
  const GUIDE_AREAS = [
    { id: "hokkaido", name: "北海道", plantAreas: ["北海道"], weatherAreas: ["北海道"] },
    { id: "tohoku", name: "東北", plantAreas: ["東北"], weatherAreas: ["東北"] },
    { id: "joshinetsu", name: "上信越・尾瀬", plantAreas: ["上信越"], weatherAreas: ["尾瀬・日光", "上信越"] },
    { id: "kita-alps", name: "北アルプス", plantAreas: ["北アルプス"], weatherAreas: ["北アルプス"] },
    { id: "hakusan", name: "白山", plantAreas: ["白山"], weatherAreas: ["白山・北陸"] },
    { id: "yatsugatake", name: "八ヶ岳・霧ヶ峰", plantAreas: ["八ヶ岳"], weatherAreas: ["八ヶ岳・美ヶ原"] },
    { id: "chuo-minami-alps", name: "中央・南アルプス", plantAreas: ["中央・南アルプス", "南アルプス"], weatherAreas: ["中央アルプス・御嶽", "南アルプス"] },
    { id: "fuji-kanto", name: "富士・関東", plantAreas: ["富士・関東"], weatherAreas: ["富士・奥秩父・丹沢"] },
    { id: "kinki-chugoku", name: "近畿・中国", plantAreas: ["近畿・中国"], weatherAreas: ["近畿・中国"] },
    { id: "shikoku", name: "四国", plantAreas: ["四国"], weatherAreas: ["四国"] },
    { id: "kyushu", name: "九州・屋久島", plantAreas: ["九州"], weatherAreas: ["九州・屋久島"] }
  ];

  // 植物データの peaks で使われている呼び名 → 山
  const PEAK_ALIASES = {
    "旭岳（大雪山）": ["大雪山"],
    "至仏山": ["尾瀬", "尾瀬ヶ原"],
    "燧ヶ岳": ["尾瀬", "尾瀬ヶ原"],
    "奥穂高岳": ["涸沢", "穂高岳"],
    "霧ヶ峰（車山）": ["霧ヶ峰", "車山"],
    "赤岳": ["八ヶ岳"],
    "硫黄岳": ["八ヶ岳"],
    "天狗岳": ["八ヶ岳"],
    "九重山（久住山）": ["九重連山", "九重山", "久住山"],
    "霧島山（韓国岳）": ["霧島連山", "霧島山", "韓国岳"],
    "宮之浦岳（屋久島）": ["宮之浦岳", "屋久島"],
    "大峰山（八経ヶ岳）": ["大峰山", "八経ヶ岳"],
    "浅間山（黒斑山）": ["浅間山", "黒斑山"]
  };

  // 植物データにあって data/mountains.json に無い山 → 山域
  const EXTRA_PEAKS = { "樽前山": "hokkaido" };

  // ブナ・亜高山針葉樹林などを含む、本州中部以北と北海道の山域
  const NORTH_AREAS = new Set(["hokkaido", "tohoku", "joshinetsu", "kita-alps", "hakusan", "yatsugatake", "chuo-minami-alps", "fuji-kanto"]);

  let loading = null;

  function load() {
    if (!loading) {
      const get = (url) => fetch(url).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
        return r.json();
      });
      loading = Promise.all([get("data/mountains.json"), get("data/plants.json"), get("data/mushrooms.json")])
        .then(([mountains, plants, mushrooms]) => {
          const areas = GUIDE_AREAS.map((a) => {
            const ms = mountains.filter((m) => a.weatherAreas.includes(m.area));
            const peakKeys = new Set(Object.keys(EXTRA_PEAKS).filter((k) => EXTRA_PEAKS[k] === a.id));
            ms.forEach((m) => peakKeysOf(m).forEach((k) => peakKeys.add(k)));
            return { ...a, mountains: ms, peakKeys };
          });
          return { mountains, plants, mushrooms, areas };
        });
    }
    return loading;
  }

  function shortName(mountain) {
    return mountain.name.replace(/（.*）/, "");
  }

  function peakKeysOf(mountain) {
    return [shortName(mountain), mountain.name, ...(PEAK_ALIASES[mountain.name] || [])];
  }

  function areaById(areas, id) {
    return areas.find((a) => a.id === id) || null;
  }

  // 山（または天気ページの山域名）→ 図鑑の山域
  function areaForMountain(areas, mountain) {
    return mountain ? areas.find((a) => a.weatherAreas.includes(mountain.area)) || null : null;
  }

  function areaForWeatherArea(areas, weatherArea) {
    return areas.find((a) => a.weatherAreas.includes(weatherArea)) || null;
  }

  // 植物データのエリア名 → 図鑑の山域名（クイズの選択肢などで使う）
  function areaNameForPlantArea(plantArea) {
    const a = GUIDE_AREAS.find((g) => g.plantAreas.includes(plantArea));
    return a ? a.name : plantArea;
  }

  // [{ item: plant, peaks: ["燕岳", ...] }]  peaks=この山域で代表的な自生地として知られる山
  function plantsForArea(area, plants) {
    return plants
      .map((p) => {
        const peaks = (p.peaks || []).filter((pk) => area.peakKeys.has(pk));
        const inArea = p.areas.some((x) => area.plantAreas.includes(x));
        return inArea || peaks.length ? { item: p, peaks } : null;
      })
      .filter(Boolean);
  }

  function mushroomsForArea(area, mushrooms) {
    const north = NORTH_AREAS.has(area.id);
    const subalpine = north && area.mountains.some((m) => m.elevation >= (area.id === "hokkaido" ? 1200 : 1800));
    return mushrooms
      .filter((m) => m.range === "all" || (m.range === "north" && north) || (m.range === "subalpine" && subalpine))
      .map((m) => ({ item: m, peaks: [] }));
  }

  // 植物 → 見られる山域
  function areasForPlant(plant, areas) {
    return areas
      .map((a) => {
        const hit = plantsForArea(a, [plant])[0];
        return hit ? { area: a, peaks: hit.peaks } : null;
      })
      .filter(Boolean);
  }

  function pageUrl(area) {
    return `mountain.html?a=${encodeURIComponent(area.id)}`;
  }

  return {
    load, areaById, areaForMountain, areaForWeatherArea, areaNameForPlantArea,
    plantsForArea, mushroomsForArea, areasForPlant, shortName, pageUrl
  };
})();
