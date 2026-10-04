/* Optional hosted offline shell. The game itself is already self-contained. */
const CACHE='volt-roast-v1.1.14';
const SHELL=['./','./index.html','./brawl.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('volt-roast-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  const page=new URL(request.url).pathname.endsWith('/brawl.html')?'./brawl.html':'./index.html';
  event.respondWith(fetch(request).then(response=>{if(response.ok){let copy=response.clone();caches.open(CACHE).then(cache=>cache.put(page,copy));}return response;}).catch(()=>caches.match(page)));
 }else event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});
