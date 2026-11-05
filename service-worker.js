const CACHE_NAME = 'medicine-learning-pwa-v1.0.0';
const CORE_ASSETS = [
  './', './index.html', './1.indel.html', './2.style.css', './3.app.js', './database.js',
  './data/config.js', './data/medicines.json', './data/questions.json', './data/flashcards.json',
  './manifest.json', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './modules/quiz-app.html', './modules/quiz.css', './modules/quiz.js',
  './modules/flashcard-app.html', './modules/flashcards.css', './modules/flashcards.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname.endsWith('/data/config.js')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) (await caches.open(CACHE_NAME)).put(request, fresh.clone());
        return fresh;
      } catch (error) {
        return (await caches.match(request)) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      if (request.mode === 'navigate') return (await caches.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});
