// Give your cache a name. If you update your app during the hackathon, 
// change this to 'v2' so the phone knows to download the new files!
const CACHE_NAME = 'deadzone-cache-v1';

// These are all the files the app needs to load when the Wi-Fi is completely off.
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/report.html',
  '/dashboard.html',
  '/style.css',
  '/app.js',
  '/hero.jpg',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap'
];

// 1. INSTALL EVENT: This fires the very first time the user visits the site.
// We use it to download and cache all our essential files.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching Files');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// 2. ACTIVATE EVENT: This cleans up old caches if you change the CACHE_NAME version.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// 3. FETCH EVENT: This is the hackathon winner. It intercepts network requests.
self.addEventListener('fetch', event => {
  event.respondWith(
    // Check if the internet connection is trying to fetch something...
    fetch(event.request)
      .catch(() => {
        // If the fetch FAILS (because there is no Wi-Fi), look in the cache instead!
        return caches.match(event.request);
      })
  );

});
