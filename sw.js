// DAIMON Service Worker
// キャッシュ名にバージョンを入れる。更新時はここだけ変更する。
const CACHE_VERSION = 'daimon-main-v1';
const CACHE_FILES = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── インストール：リソースをキャッシュ ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(CACHE_FILES))
      .then(() => self.skipWaiting())  // 新SWを即アクティブ化
  );
});

// ── アクティベート：古いキャッシュを削除 ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())  // 既存タブにも即適用
  );
});

// ── フェッチ：Cache First（オフライン対応） ─────────────────
// キャッシュにあればキャッシュを返す。なければネットワークを試みる。
// ネットワークも失敗した場合はキャッシュのindex（daimon-v7b.html）を返す。
self.addEventListener('fetch', event => {
  // chrome-extension や非http(s)リクエストはスキップ
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          // 有効なレスポンスだけキャッシュに追加
          if (response && response.status === 200 && response.type === 'basic') {
            const toCache = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(event.request, toCache));
          }
          return response;
        })
        .catch(() => {
          // オフライン時のフォールバック：メイン画面を返す
          return caches.match('./index.html');
        });
    })
  );
});
