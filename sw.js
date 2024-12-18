const cacheName = 'chat-analyzer-v1';
const staticAssets = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
      './icon.png'  // Add your own icon
];

self.addEventListener('install', async event => {
  const cache = await caches.open(cacheName);
  await cache.addAll(staticAssets);
});

self.addEventListener('fetch', event => {
    const req = event.request;
    const url = new URL(req.url);

    if(url.origin === location.origin){
          event.respondWith(cacheFirst(req));
    } else {
      event.respondWith(networkFirst(req));
    }


});
async function cacheFirst(req){
    const cacheResponse = await caches.match(req);
  return cacheResponse || fetch(req);
}

async function networkFirst(req){
  const dynamicCache = await caches.open('dynamic-chat-analyzer');
  try{
        const networkResponse = await fetch(req);
        dynamicCache.put(req, networkResponse.clone());
         return networkResponse;

  } catch (err) {
     const cachedResponse = await dynamicCache.match(req);
        return cachedResponse || caches.match("./offline.html"); // You can include an offline.html in your static assets for better user experience

  }
}
