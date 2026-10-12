/* Installable, local-first PWA. Remote Google endpoints are never cached by our SW. */
(() => {
 'use strict';
 if(!('serviceWorker' in navigator)||!(location.protocol==='https:'||/^(localhost|127\.0\.0\.1)$/.test(location.hostname)))return;
 window.addEventListener('load',async()=>{
  try{
   const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
   registration.addEventListener('updatefound',()=>{
    const worker=registration.installing;
    worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)message('PACE has an update. Refresh to install it.');});
   });
  }catch(e){console.warn('Offline app installation unavailable:',e.message)}
 });
 let installPrompt=null;
 window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();installPrompt=e;
  const sidebar=document.getElementById('sidebar');if(!sidebar||document.getElementById('paceInstallBtn'))return;
  const btn=document.createElement('button');btn.type='button';btn.className='nav-link';btn.id='paceInstallBtn';btn.innerHTML='<span aria-hidden="true">⬇</span><span>Install PACE app</span>';
  btn.addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;btn.remove();});
  sidebar.querySelector('.sidebar-bottom')?.before(btn);
 });
 function message(content){const t=document.createElement('div');t.className='v5-pwa-toast';t.setAttribute('role','status');t.textContent=content;document.body.append(t);setTimeout(()=>t.remove(),6500);}
 window.addEventListener('offline',()=>message('Offline mode: your edits remain saved on this device until cloud sync resumes.'));
 window.addEventListener('online',()=>message('Connection restored. Sign in with Google to check queued cloud changes.'));
})();
