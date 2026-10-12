/* PACE V5 offline app shell. Does NOT intercept or store Google requests. */
const CACHE='pace-v5-shell-20261012-01';
const APP_SHELL=['./','./index.html','./styles.css','./motion.css','./v4.css','./race.css','./v5.css','./plan.js','./importers.js','./app.js','./motion.js','./cloud.js','./v5.js','./pwa.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
const OWN=new Set(APP_SHELL.map(x=>new URL(x,self.registration.scope).pathname));
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('pace-v')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(!OWN.has(url.pathname))return;
 if(req.mode==='navigate'){
   event.respondWith(fetch(req).then(response=>response.ok?response:Promise.reject(new Error('Offline'))).catch(async()=>await caches.match('./index.html')||Response.error()));
 }else{
   event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
 }
});
