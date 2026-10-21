/**
 * 山中など電波の無い場所でも図鑑・山の図鑑と一度表示した画像が使えるように、
 * アプリ本体とWikimedia Commonsの画像をキャッシュするService Worker。
 */
const CACHE_VERSION = "v18";
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const IMAGE_CACHE = `wikimedia-images-${CACHE_VERSION}`;

const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./about.html",
  "./privacy.html",
  "./plant.html",
  "./quiz.html",
  "./topic.html",
  "./weather.html",
  "./course-search.html",
  "./mountain.html",
  "./css/style.css",
  "./js/wikimedia.js",
  "./js/text-flow.js",
  "./js/hero-mosaic.js",
  "./js/scroll-mask.js",
  "./js/app.js",
  "./js/plant-detail.js",
  "./js/quiz.js",
  "./js/topic-game.js",
  "./js/weather.js",
  "./js/mountain-flora.js",
  "./js/mountain.js",
  "./js/course-search.js",
  "./js/register-sw.js",
  "./data/plants.json",
  "./data/topics.json",
  "./data/mountains.json",
  "./data/courses.json",
  "./data/japan-outline.json",
  "./data/areas.json",
  "./data/mushrooms.json",
  "./manifest.json",
  "./icon.svg",
  "./images/logo.svg",
  "./images/icons/apple-touch-icon.png",
  "./images/icons/icon-192.png"
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
