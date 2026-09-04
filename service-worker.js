/**
 * 山中など電波の無い場所でも「絞り込み検索」と一度表示した植物画像が使えるように、
 * アプリ本体とWikimedia Commonsの画像をキャッシュするService Worker。
 * Pl@ntNet APIによる画像識別は都度通信が必要な機能のため、意図的にキャッシュしない。
 */
const CACHE_VERSION = "v2";
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const IMAGE_CACHE = `wikimedia-images-${CACHE_VERSION}`;

const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./about.html",
  "./privacy.html",
  "./plant.html",
  "./css/style.css",
  "./js/config.js",
  "./js/wikimedia.js",
  "./js/app.js",
  "./js/image-search.js",
  "./js/community.js",
  "./js/plant-detail.js",
  "./js/register-sw.js",
  "./data/plants.json",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_SHELL_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Wikimedia Commonsの画像・APIレスポンスはキャッシュして山中での再表示に使う
  if (url.hostname === "commons.wikimedia.org" || url.hostname === "upload.wikimedia.org") {
    event.respondWith(cacheFirst(req, IMAGE_CACHE));
    return;
  }

  // Pl@ntNet APIは常に最新の識別結果が必要なため素通し（オフライン時は失敗する仕様）
  if (url.hostname === "my-api.plantnet.org") {
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req, APP_SHELL_CACHE));
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    // オフライン時も即座に返しつつ、裏で次回用に更新を試みる
    networkFetch.catch(() => {});
    return cached;
  }

  const fresh = await networkFetch;
  return fresh || Response.error();
}
