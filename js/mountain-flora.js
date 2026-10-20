/**
 * 山（data/mountains.json）と、そこで見られる高山植物・キノコを結びつける共通モジュール。
 * 山の図鑑ページ・クイズ・植物の詳細ページから使う。
 *
 * 高山植物：植物データの peaks（具体的な山名）に一致すれば「この山の記録あり」、
 *   一致しなくてもエリアが合えば「このエリアで見られる」とする。
 *   ただし標高の低い山にエリア単位の高山植物を出すと誤解を招くので、エリア一致は森林限界に近い高さの山に限る
 *   （本州以南は1500m以上、森林限界の低い北海道は1000m以上）。
 * キノコ：分布の目安（range）と山の地域・標高から判定する。
 */
const MountainFlora = (() => {
  // 天気ページの山域 → 植物データのエリア
  const PLANT_AREAS = {
    "北海道": ["北海道"],
    "東北": ["東北"],
    "尾瀬・日光": ["上信越"],
    "上信越": ["上信越"],
    "北アルプス": ["北アルプス"],
    "中央アルプス・御嶽": ["中央・南アルプス"],
    "八ヶ岳・美ヶ原": ["八ヶ岳"],
    "南アルプス": ["中央・南アルプス", "南アルプス"],
    "富士・奥秩父・丹沢": ["富士・関東"],
    "白山・北陸": ["白山"],
    "近畿・中国": ["近畿・中国"],
    "四国": ["四国"],
    "九州・屋久島": ["九州"]
  };

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

  // ブナ・亜高山針葉樹林などを含む、本州中部以北と北海道の山域
  const NORTH_AREAS = new Set([
    "北海道", "東北", "尾瀬・日光", "上信越", "北アルプス", "中央アルプス・御嶽",
    "八ヶ岳・美ヶ原", "南アルプス", "富士・奥秩父・丹沢", "白山・北陸"
  ]);

  const ALPINE_MIN_ELEVATION = 1500;
  const ALPINE_MIN_ELEVATION_HOKKAIDO = 1000;

  let loading = null;

  function load() {
    if (!loading) {
      const get = (url) => fetch(url).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
        return r.json();
      });
      loading = Promise.all([get("data/mountains.json"), get("data/plants.json"), get("data/mushrooms.json")])
        .then(([mountains, plants, mushrooms]) => ({ mountains, plants, mushrooms }));
    }
    return loading;
  }

  function shortName(mountain) {
    return mountain.name.replace(/（.*）/, "");
  }

  function peakKeys(mountain) {
    return new Set([shortName(mountain), mountain.name, ...(PEAK_ALIASES[mountain.name] || [])]);
  }

  // [{ item: plant, here: true|false }]  here=この山の記録あり
  function plantsFor(mountain, plants) {
    const keys = peakKeys(mountain);
    const areas = PLANT_AREAS[mountain.area] || [];
    const alpine = mountain.elevation >= (mountain.area === "北海道" ? ALPINE_MIN_ELEVATION_HOKKAIDO : ALPINE_MIN_ELEVATION);
    return plants
      .map((p) => {
        const here = (p.peaks || []).some((pk) => keys.has(pk));
        const inArea = alpine && p.areas.some((a) => areas.includes(a));
        return here || inArea ? { item: p, here } : null;
      })
      .filter(Boolean);
  }

  function mushroomsFor(mountain, mushrooms) {
    const north = NORTH_AREAS.has(mountain.area);
    const subalpine = north && mountain.elevation >= (mountain.area === "北海道" ? 1200 : 1800);
    return mushrooms
      .filter((m) => m.range === "all" || (m.range === "north" && north) || (m.range === "subalpine" && subalpine))
      .map((m) => ({ item: m, here: false }));
  }

  // 植物 → 見られる山（記録のある山を先に）
  function mountainsForPlant(plant, mountains) {
    return mountains
      .map((m) => {
        const hit = plantsFor(m, [plant])[0];
        return hit ? { mountain: m, here: hit.here } : null;
      })
      .filter(Boolean)
      .sort((a, b) => Number(b.here) - Number(a.here));
  }

  function pageUrl(mountain) {
    return `mountain.html?m=${encodeURIComponent(mountain.name)}`;
  }

  return { load, plantsFor, mushroomsFor, mountainsForPlant, shortName, pageUrl };
})();
