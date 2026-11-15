/* 极速对决 Service Worker：预缓存 + 离线可玩 + 版本更新
   仅在 http(s) 下注册（file:// 自动禁用，游戏本体不受影响） */
'use strict';
const VERSION = 'drag-kings-v3';
const CACHE = 'dragKings-' + VERSION;
const PRECACHE = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/assets.js', './js/data.js', './js/audio.js', './js/physics.js',
  './js/render.js', './js/ui.js', './js/game.js',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/icon-maskable-512.png',
  './assets/opengameart/side-view-cars/audi.png',
  './assets/opengameart/side-view-cars/audi4.png',
  './assets/opengameart/side-view-cars/truck.png',
  './assets/opengameart/side-view-cars/supercar.png',
  './assets/opengameart/side-view-cars/wedge_gold.png',
  './assets/opengameart/side-view-cars/wedge_blue.png',
  './assets/kenney/particle-pack/smoke_01.png',
  './assets/kenney/particle-pack/smoke_04.png',
  './assets/kenney/particle-pack/smoke_07.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 同源 GET：缓存优先 + 后台刷新（stale-while-revalidate）；其余直连 */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

/* 页面请求立即激活新版本 */
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
