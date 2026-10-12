/* PACE V5: Google Identity Services ID token + Apps Script allowlisted bridge.
 * ID token stays in memory only. Offline changes retain their local snapshot.
 */
(() => {
  'use strict';
  const CFG = 'pace.cloud.endpoint.v1';
  const CLIENT = 'pace.cloud.client_id.v5';
  const REVKEY = 'pace.cloud.revision.v5';
  const DIRTY = 'pace.cloud.local.pending.v1';
  const app = window.PACE_APP;
  const $ = id => document.getElementById(id);
  const dialog = $('cloudDialog');
  if (!app || !dialog) return;
  let bridge = null, lastSeen = null, revision = null, active = false;
  let saving = false, timer = null, syncing = false, generation = 0;
  let lastSyncedJSON = '';
  let endpoint = localStorage.getItem(CFG) || '';
  let idToken = '';
  let clientId = localStorage.getItem(CLIENT) || '';
  let knownRev = localStorage.getItem(REVKEY);
  knownRev = knownRev === null ? null : Number(knownRev);
  let pending = localStorage.getItem(DIRTY) === '1';

  const header = $('cloudTopLabel'), dot = $('cloudTopDot'), nav = $('cloudNavDot');
  const statTitle = $('cloudStateTitle'), statHelp = $('cloudStateHelp');
  const warning = $('cloudWarning'), workspace = $('cloudWorkspace'), inspect = $('cloudInspection');
  const epField = $('cloudEndpoint'), clientField = $('cloudClientId');
  epField.value = endpoint;
  clientField.value = clientId;

  function setStatus(state, title, detail) {
    document.body.dataset.cloudState = state;
    statTitle.textContent = title;
    statHelp.textContent = detail;
    header.textContent = state === 'synced' ? 'Cloud synced' : state === 'saving' ? 'Syncing…' : state === 'conflict' ? 'Sync conflict' : state === 'offline' ? 'Sync paused' : state === 'ready' ? 'Cloud available' : 'Local only';
    dot.title = title; nav.title = title;
    $('cloudFooter').textContent = state === 'synced' ? 'Google Sheets connected • Browser backup maintained' : state === 'saving' ? 'Saving to Google Sheets…' : state === 'conflict' ? 'Local changes kept • Resolve cloud conflict' : 'Local-first data • Cloud syncing optional';
  }
  function showError(message) { warning.hidden = false; warning.textContent = message; }
  function clearError() { warning.hidden = true; warning.textContent = ''; }
  function currentEndpoint() { return (epField.value || '').trim(); }
  function isUrl(u) { return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec(?:\?.*)?$/.test(u); }
  function safeGoogleOrigin(origin) {
    try { const u = new URL(origin); return u.protocol === 'https:' && (u.hostname === 'script.google.com' || u.hostname === 'googleusercontent.com' || u.hostname.endsWith('.googleusercontent.com')); }
    catch { return false; }
  }
  function mkNonce() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2,'0')).join('');
  }
  function closeBridge() {
    if (!bridge) return;
    const old = bridge; bridge = null;
    old.dispose();
  }
  async function mountBridge(url) {
    closeBridge();
    const nonce = mkNonce();
    const frame = document.createElement('iframe');
    frame.id = 'paceSheetsTransport'; frame.title = 'PACE secure Google Sheets sync bridge';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;left:-9999px;top:-9999px;';
    const parsed = new URL(url); parsed.searchParams.set('pace_nonce', nonce);
    frame.src = parsed.href;
    const requests = new Map();
    let readyResolve, readyReject, readyTimer;
    const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    const b = {nonce, frame, origin:null, source:null, requests, disposed:false,
      dispose() {
        this.disposed = true;
        clearTimeout(readyTimer);
        window.removeEventListener('message', receive);
        for (const [id,p] of requests) {clearTimeout(p.timer); p.reject(new Error('Cloud connection closed'));}
        requests.clear(); frame.remove();
        readyReject(new Error('Connection closed'));
      },
      async rpc(action, payload = {}, wait = 30000) {
        await ready;
        if (this.disposed) throw new Error('Connection closed');
        const id = mkNonce();
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {requests.delete(id);reject(new Error('Cloud request timed out. Your local data is safe.'));}, wait);
          requests.set(id,{resolve,reject,timer});
          this.source.postMessage({pace:'PACE_BRIDGE',kind:'request',nonce,id,action,payload,idToken},this.origin);
        });
      }
    };
    function receive(e) {
      if (b.disposed || !safeGoogleOrigin(e.origin)) return;
      const m = e.data;
      if (!m || m.pace !== 'PACE_BRIDGE' || m.nonce !== nonce) return;
      if (m.kind === 'ready') {
        b.origin = e.origin; b.source = e.source;
        clearTimeout(readyTimer); readyResolve();
      } else if (m.kind === 'response' && e.source === b.source) {
        const pendingRequest = requests.get(m.id);
        if (!pendingRequest) return;
        requests.delete(m.id);clearTimeout(pendingRequest.timer);
        if (m.success) pendingRequest.resolve(m.data);
        else pendingRequest.reject(new Error(m.error || 'Cloud service returned an error'));
      }
    }
    window.addEventListener('message',receive);
    bridge = b;
    document.body.appendChild(frame);
    readyTimer = setTimeout(() => readyReject(new Error('Could not open the Google Apps Script bridge. Verify deployment permissions, the URL and allowed site origin.')),16000);
    try { await ready; return b; } catch (e) { closeBridge();throw e; }
  }
  function summarize(s, rev) {
    const d=s||{};
    return `Cloud version ${rev} · ${d.runs?.length||0} runs · ${d.meals?.length||0} food entries · ${d.tasks?.length||0} activities · ${d.plan?.length||0} planned sessions · ${d.recovery?.length||0} recovery check-ins.`;
  }
  function markPending() {pending = true; localStorage.setItem(DIRTY,'1');}
  function setRevision(value){knownRev=Number(value);localStorage.setItem(REVKEY,String(knownRev));}
  function markClean() {pending = false;localStorage.removeItem(DIRTY);}
  function showRemote(r) {
    lastSeen = r;
    workspace.hidden = false;
    inspect.textContent = summarize(r.snapshot, r.revision) + (pending ? ' There are unsynced entries in this browser.' : ' Choose the copy to use when connecting for the first time.');
  }
  async function connect({automatic=false}={}) {
    if(syncing)return;
    clearError();
    const url=endpoint || currentEndpoint();
    if(!isUrl(url)) {showError('Enter a valid Apps Script /exec URL first.');return;}
    if(!idToken){showError('Select your Google account with the Sign in with Google button first.');return;}
    syncing=true;$('cloudConnectBtn').disabled=true;active=false;revision=null;
    setStatus('saving','Verifying Google account…','Checking identity and existing cloud records.');
    try {
      const b=await mountBridge(url);
      const remote=await b.rpc('load',{});
      if(!remote||!remote.ok||!remote.snapshot||Number(remote.snapshot.version)!==6)throw new Error('The V5 Apps Script backend is required. Run initializePace and redeploy.');
      revision=Number(remote.revision);showRemote(remote);
      if(pending && knownRev!==null && knownRev===revision){
        // Only auto-upload an offline snapshot when no other device has updated the cloud.
        active=true;workspace.hidden=true;setStatus('saving','Restoring offline edits…','The cloud version matches this device’s last synchronized revision.');
        await syncData();
      }else if(pending && knownRev!==null && revision!==knownRev){
        active=false;setStatus('conflict','Cloud changed during offline editing','No overwrite: choose between the local and cloud copies after exporting a backup.');
        showError('The cloud version advanced while this device had unsynced changes. Compare the records and choose a copy.');
      }else if(!pending && knownRev!==null){
        app.replace(remote.snapshot);lastSyncedJSON=JSON.stringify(app.snapshot());
        active=true;markClean();setRevision(revision);workspace.hidden=true;
        setStatus('synced','Google Sheets connected',summarize(remote.snapshot,revision));
      }else{
        setStatus('ready','Google Sheets ready','Choose your cloud or browser data for the first connection.');
        if(!automatic)app.notify('Choose cloud data or upload this browser’s copy');
      }
    }catch(e){active=false;closeBridge();setStatus('offline','Cloud unavailable','Local logs stay available offline.');showError(e.message);}
    finally{syncing=false;$('cloudConnectBtn').disabled=false;}
  }
  async function loadCloud() {
    if (!bridge) return showError('Connect to Apps Script first.');
    if (!lastSeen) return showError('Check latest cloud data first.');
    const local = app.snapshot();
    const changed = JSON.stringify(local) !== JSON.stringify(lastSeen.snapshot);
    if (changed && !window.confirm('Replace this browser’s data with Google Sheets data? Unsynced browser edits will be lost. Download a JSON backup first if needed.')) return;
    clearTimeout(timer); generation++;
    app.replace(lastSeen.snapshot);
    revision=Number(lastSeen.revision);active=true;lastSyncedJSON=JSON.stringify(app.snapshot());markClean();setRevision(revision);workspace.hidden=true;
    setStatus('synced','Google Sheets connected',summarize(lastSeen.snapshot,revision));
    app.notify('Loaded your Google Sheets data');
  }
  async function uploadLocal() {
    if (!bridge || !lastSeen) return showError('Connect and check cloud data first.');
    if (!window.confirm('Replace the current Google Sheets data with ALL data in this browser? This overwrites the cloud copy. Consider downloading a JSON backup of either copy first.')) return;
    clearError();setStatus('saving','Uploading browser data…','Do not close this tab until it finishes.');
    const payload=JSON.parse(JSON.stringify(app.snapshot()));
    const version=Number(lastSeen.revision);
    try {
      const result=await bridge.rpc('save',{snapshot:payload,expectedRevision:version},60000);
      if (result.conflict) {markPending();active=false;lastSeen=null;setStatus('conflict','Cloud changed elsewhere','Check latest before uploading again.');showError('Another device saved new data. No overwrite occurred; click Check latest.');return;}
      if (!result.ok) throw new Error(result.error||'Upload was not accepted');
      revision=result.revision;setRevision(revision);active=true;lastSyncedJSON=JSON.stringify(payload);
      lastSeen={snapshot:payload,revision};
      if (JSON.stringify(app.snapshot())===lastSyncedJSON) markClean();else {markPending();queueSync();}
      workspace.hidden=true;setStatus('synced','Google Sheets connected',summarize(payload,revision));app.notify('Browser data saved to Google Sheets');
    } catch (e){markPending();active=false;setStatus('offline','Upload unsuccessful','Your data is still saved in this browser.');showError(e.message);}
  }
  function queueSync() {
    if (!active || !bridge) return;
    clearTimeout(timer);
    timer=setTimeout(syncData,1200);
  }
  async function syncData() {
    if (saving || !active || !bridge) return;
    const snapshot=app.snapshot(), json=JSON.stringify(snapshot);
    if (json === lastSyncedJSON) {markClean();return;}
    saving=true;setStatus('saving','Saving changes to Google Sheets…','Local copy already saved.');
    const sentRevision=revision;
    try {
      const res=await bridge.rpc('save',{snapshot,expectedRevision:sentRevision},60000);
      if (res.conflict) {
        active=false;lastSeen=null;markPending();workspace.hidden=false;
        setStatus('conflict','Conflict: newer cloud data','Local changes are protected. Review both copies before proceeding.');
        showError('Another device updated the Google Sheet since your last sync. Use Check latest, then choose to keep cloud or overwrite it.');
        app.notify('Cloud conflict: changes kept locally');
      } else if (!res.ok) throw new Error(res.error||'Save rejected');
      else {
        revision=res.revision;setRevision(revision);lastSyncedJSON=json;
        if (JSON.stringify(app.snapshot()) === json) {
          markClean();setStatus('synced','Google Sheets up to date',`Cloud version ${revision} · Last update ${new Date().toLocaleTimeString()}`);
        } else {markPending();setStatus('saving','More changes pending','Finishing your next update.');}
      }
    } catch (e) {
      active=false;markPending();workspace.hidden=false;
      setStatus('offline','Sync paused: connection error','All unsynced entries remain in this browser.');
      showError(e.message); app.notify('Cloud unavailable. Your entries remain local.');
    } finally {
      saving=false;
      if (active && pending) queueSync();
    }
  }
  async function checkLatest() {
    if (!bridge) return showError('Connect first.');
    try {const remote=await bridge.rpc('load',{});if(!remote.ok)throw new Error('Could not retrieve cloud data');showRemote(remote);setStatus('ready','Latest cloud snapshot retrieved',summarize(remote.snapshot,remote.revision));active=false;revision=remote.revision;clearError();}
    catch (e) {showError(e.message);}
  }
  function disconnect() {
    clearTimeout(timer);generation++;active=false;closeBridge();revision=null;lastSeen=null;
    localStorage.removeItem(CFG);localStorage.removeItem(CLIENT);localStorage.removeItem(REVKEY);
    idToken='';endpoint='';clientId='';clientField.value='';epField.value='';workspace.hidden=true;
    $('googleSignIn').replaceChildren();$('cloudUserLabel').textContent='Not signed in';
    setStatus('local','Browser storage only','Cloud settings cleared on this device. Your local records were kept.');
    clearError();app.notify('Cloud disconnected — your browser data remains');
  }
  // Synchronization is intentionally attached only to *data changes*, never navigation or rendering.
  document.addEventListener('pace:data-changed', () => {
    if (!endpoint && !currentEndpoint()) return;
    markPending(); queueSync();
  });
  function onCredential(response) {
    if(!response||!response.credential)return showError('Google did not supply an ID token. Try signing in again.');
    idToken=response.credential;
    // Decoded claim is display-only. The server verifies signature, audience, issuer, expiry and allowlist.
    try {const claim=JSON.parse(atob(idToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));$('cloudUserLabel').textContent='Signed in: '+String(claim.email||'Google account');}catch{$('cloudUserLabel').textContent='Google account selected';}
    connect();
  }
  function setupGoogleButton() {
    if(!window.google?.accounts?.id) {showError('Google sign-in has not loaded. Connect to the internet and try again.');return;}
    if(!/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId)){showError('Enter your Google OAuth Web Client ID.');return;}
    try {
      window.google.accounts.id.initialize({client_id:clientId,callback:onCredential,auto_select:false,ux_mode:'popup'});
      $('googleSignIn').replaceChildren();
      window.google.accounts.id.renderButton($('googleSignIn'),{type:'standard',theme:'outline',size:'large',text:'signin_with',shape:'rectangular'});
      clearError();setStatus('ready','Google sign-in ready','Choose the Google account allowlisted in Apps Script.');
    }catch(e){showError('Could not prepare Google sign-in: '+e.message);}
  }
  function prepare(e){e.preventDefault();const url=currentEndpoint(),cid=clientField.value.trim();
    if(!isUrl(url))return showError('Enter your Apps Script web app /exec URL.');
    if(!/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(cid))return showError('Check your Google OAuth Web Client ID.');
    endpoint=url;clientId=cid;localStorage.setItem(CFG,url);localStorage.setItem(CLIENT,cid);setupGoogleButton();
  }
  $('cloudForm').addEventListener('submit',prepare);
  window.addEventListener('online',()=>{if(endpoint&&idToken&&pending&&!syncing)connect({automatic:true});});
  $('cloudDownloadBtn').addEventListener('click',loadCloud);
  $('cloudUploadBtn').addEventListener('click',uploadLocal);
  $('cloudRefreshBtn').addEventListener('click',checkLatest);
  $('cloudDisconnectBtn').addEventListener('click',()=>{if(pending && !window.confirm('Unsynced data will remain in this browser, but cloud sync will be disconnected. Continue?'))return;disconnect();});
  const open = () => dialog.showModal();
  $('cloudBtn').addEventListener('click',open);$('cloudTopBtn').addEventListener('click',open);
  dialog.querySelector('.close-cloud').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  setStatus(endpoint?'offline':'local',endpoint?'Cloud configured — sign in to sync':'Browser storage only',endpoint?'Sign in with your allowlisted Google account.':'Add Google Sheets when ready.');
  // Google Identity Services loads asynchronously. Draw its button when the dialog is opened.
  let gisAttempts=0;const gisWait=setInterval(()=>{if(window.google?.accounts?.id){clearInterval(gisWait);if(endpoint&&clientId)setupGoogleButton();}else if(++gisAttempts>40)clearInterval(gisWait);},300);
})();
