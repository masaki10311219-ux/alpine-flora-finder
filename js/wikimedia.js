/**
 * Wikimedia Commons から学名検索で画像とクレジット情報を取得するヘルパー。
 * ブラウザから直接 Commons API を叩く（CORS は origin=* で許可される）。
 * 取得結果はメモリ内キャッシュに保持し、同じ学名への再リクエストを避ける。
 */
const WikimediaImages = (() => {
  const API_BASE = "https://commons.wikimedia.org/w/api.php";
  const cache = new Map();
  const FALLBACK_IMG = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#e7f2e8"/><text x="50%" y="50%" font-size="18" fill="#3d8451" text-anchor="middle" dominant-baseline="middle">画像準備中</text></svg>'
  );

  async function fetchImage(scientificName) {
    if (cache.has(scientificName)) return cache.get(scientificName);

    const promise = lookup(scientificName).catch(() => ({
      url: FALLBACK_IMG,
      credit: null
    }));
    cache.set(scientificName, promise);
    return promise;
  }

  async function lookup(scientificName) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      generator: "search",
      gsrsearch: `filetype:bitmap ${scientificName}`,
      gsrnamespace: "6",
      gsrlimit: "1",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "600"
    });

    const res = await fetch(`${API_BASE}?${params.toString()}`);
    if (!res.ok) throw new Error("commons api error");
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) throw new Error("no image found");

    const page = Object.values(pages)[0];
    const info = page?.imageinfo?.[0];
    if (!info) throw new Error("no imageinfo");

    const meta = info.extmetadata || {};
    const artist = stripHtml(meta.Artist?.value) || "Wikimedia Commons";
    const license = meta.LicenseShortName?.value || "";

    return {
      url: info.thumburl || info.url,
      credit: {
        artist,
        license,
        pageUrl: info.descriptionurl
      }
    };
  }

  function stripHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.innerHTML = str;
    return div.textContent.trim();
  }

  return { fetchImage, FALLBACK_IMG };
})();
