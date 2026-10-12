/* PACE V4 — Offline-only activity file parsing. No data is uploaded during import. */
window.PACE_IMPORT = (() => {
'use strict';
const EPOCH=631065600000, RAD=Math.PI/180;
function asDate(sec){return new Date(EPOCH+sec*1000).toISOString().slice(0,10);}
function haversine(a,b){const dLat=(b.lat-a.lat)*RAD,dLon=(b.lon-a.lon)*RAD;const x=Math.sin(dLat/2)**2+Math.cos(a.lat*RAD)*Math.cos(b.lat*RAD)*Math.sin(dLon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
function sane(v,min,max){return Number.isFinite(v)&&v>=min&&v<=max?v:null;}
function avg(a){let x=a.filter(v=>v!==null&&Number.isFinite(v));return x.length?x.reduce((p,c)=>p+c,0)/x.length:null;}
function thin(points,max=125){if(points.length<=max)return points;return Array.from({length:max},(_,i)=>points[Math.round(i*(points.length-1)/(max-1))]);}
function cleanRoute(points){return JSON.stringify(thin(points.filter(p=>sane(p.lat,-90,90)!==null&&sane(p.lon,-180,180)!==null).map(p=>[+p.lat.toFixed(5),+p.lon.toFixed(5)]),125));}
function finalize(points,meta={}) {
  if(points.length<2&&!meta.distance)throw Error('Not enough activity data: a run needs distance and time or two timestamped points.');
  const records=points.filter(p=>p.t!==null&&Number.isFinite(p.t)).sort((a,b)=>a.t-b.t);
  let dist=0, climb=0, lastGPS=null, lastAlt=null;
  for(const p of records){
    if(Number.isFinite(p.dist)&&p.dist>=0){dist=Math.max(dist,p.dist);}
    else if(p.lat!==null&&p.lon!==null&&lastGPS){const gap=haversine(lastGPS,p);if(gap<1500)dist+=gap;}
    if(p.lat!==null&&p.lon!==null)lastGPS=p;
    if(p.ele!==null&&lastAlt!==null){const d=p.ele-lastAlt;if(d>2&&d<100)climb+=d;}
    if(p.ele!==null)lastAlt=p.ele;
    p.d=dist;
  }
  const first=records[0],last=records.at(-1);
  const total=meta.duration||((last&&first)?(last.t-first.t):0);
  const meters=meta.distance||dist;
  if(!(meters>50&&total>0))throw Error('The file does not contain a valid run distance and moving duration.');
  let splits=[];
  // Derive approximate kilometer elapsed splits only when time-series data are available.
  if(records.length>2){const start=records[0].t;let goal=1000,prev=records[0];for(const p of records.slice(1)){
    while(p.d>=goal&&prev.d<goal&&goal<=meters&&splits.length<200){const f=(goal-prev.d)/Math.max(0.1,p.d-prev.d),t=prev.t+(p.t-prev.t)*f;const prior=splits.length?(splits.at(-1).elapsed):0;const elapsed=Math.max(0,t-start);splits.push({km:splits.length+1,secs:Math.round(elapsed-prior),elapsed:Math.round(elapsed)});goal+=1000;}
    prev=p;
  }}
  const pts=records.filter(p=>p.lat!==null&&p.lon!==null);
  return {date:meta.date||(first?new Date(first.t*1000).toISOString().slice(0,10):null),distance:+(meters/1000).toFixed(2),duration:Math.round(total),hr:meta.hr??(avg(records.map(p=>p.hr))?Math.round(avg(records.map(p=>p.hr))):null),cadence:meta.cadence??(avg(records.map(p=>p.cadence))?Math.round(avg(records.map(p=>p.cadence))):null),elevation:Math.round(meta.elevation??climb),temperature:meta.temperature??null,route:cleanRoute(pts),splits:JSON.stringify(splits),source:'COROS file',device:meta.device||'',type:meta.type||'Easy',rpe:null,sleep:null,fuelCarbs:null,fluids:null,shoe:'',notes:''};
}
function childText(node,name){let a=Array.from(node.getElementsByTagName('*')).find(x=>x.localName?.toLowerCase()===name.toLowerCase());return a?.textContent?.trim()||'';}
function parseGPX(text){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('Invalid GPX XML.');const xmlPoints=Array.from(doc.getElementsByTagName('*')).filter(x=>x.localName==='trkpt');if(xmlPoints.length<2)throw Error('No GPX track points found.');const samples=[];for(const e of xmlPoints){const lat=Number(e.getAttribute('lat')),lon=Number(e.getAttribute('lon'));const stamp=Date.parse(childText(e,'time'));if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(stamp))continue;const hr=Number(childText(e,'hr'));const cad=Number(childText(e,'cad'));const ele=Number(childText(e,'ele'));samples.push({t:stamp/1000,lat,lon,ele:Number.isFinite(ele)?ele:null,hr:sane(hr,30,250),cadence:sane(cad,25,250),dist:null});}
  return [finalize(samples)];}
function textCSV(text){const lines=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))lines.push(row);row=[];cell='';}else cell+=c;}row.push(cell);if(row.some(x=>x.trim()))lines.push(row);return lines;}
function norm(x){return String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function parseDuration(v){let str=String(v||'').trim();if(!str)return NaN;if(/^\d+(?:\.\d+)?$/.test(str))return Number(str);let p=str.split(':').map(Number);if(p.some(x=>!Number.isFinite(x)))return NaN;if(p.length===3)return p[0]*3600+p[1]*60+p[2];if(p.length===2)return p[0]*60+p[1];return NaN;}
function csvRows(text){const rows=textCSV(text.replace(/^\uFEFF/,''));if(rows.length<2)throw Error('CSV requires a header and at least one record.');const heads=rows[0].map(norm),ids=new Set();const get=(r,keys)=>{for(const k of keys){let i=heads.indexOf(norm(k));if(i!==-1&&r[i]!==undefined&&String(r[i]).trim()!=='')return String(r[i]).trim();}return '';};
  const results=[];
  for(const r of rows.slice(1)){
    let rawDist=get(r,['distancekm','totalkm','distance','distancem','totaldistance']);let dist=Number(rawDist.replace(/,/g,''));let distCol=heads.find(x=>['distancekm','totalkm','distance','distancem','totaldistance'].includes(x))||'';if(distCol.endsWith('m')&&!distCol.endsWith('km'))dist/=1000;
    const rawTime=get(r,['movingtime','duration','elapsedtime','totaltime','time','runningtime']);let duration=parseDuration(rawTime);if(rawTime&&/^\d+(\.\d+)?$/.test(rawTime)){const timeCol=heads.find(x=>['movingtime','duration','elapsedtime','totaltime','time','runningtime'].includes(x));if(timeCol==='time'&&duration<60)duration*=60;}
    const rawDate=get(r,['date','activitydate','startdate','starttime','dateandtime']);const parsedDate=/^\d{4}-\d{2}-\d{2}/.test(rawDate)?rawDate.slice(0,10):!Number.isNaN(Date.parse(rawDate))?new Date(rawDate).toISOString().slice(0,10):'';
    if(!parsedDate||!(dist>0&&dist<1000&&duration>0))continue;
    const kind=get(r,['activitytype','sport','type']);const hr=Number(get(r,['averageheartrate','avghr','heartrate','averagehr']));const cadence=Number(get(r,['averagecadence','avgcadence','cadence']));const climb=Number(get(r,['elevationgain','totalascent','ascent']));
    const key=`${parsedDate}|${dist}|${duration}`;if(ids.has(key))continue;ids.add(key);
    results.push({date:parsedDate,distance:dist,duration:Math.round(duration),hr:sane(hr,35,245),cadence:sane(cadence,30,250),elevation:sane(climb,0,20000),temperature:null,source:'COROS CSV',route:'[]',splits:'[]',device:'',type:/race/i.test(kind)?'Race':/interval/i.test(kind)?'Interval':/long/i.test(kind)?'Long run':'Easy',rpe:null,sleep:null,fuelCarbs:null,fluids:null,shoe:'',notes:''});
  }
  if(!results.length)throw Error('Could not recognize summary columns. CSV must have date, distance (km or distance_m), and duration/moving time. Convert duration to hh:mm:ss when possible.');return results.slice(0,500);
}
function fitValue(view,pos,size,type,little){const base=type&31;if(pos+size>view.byteLength)return null;let out=null;try{switch(base){case 0:case 2:case 10:case 13:out=view.getUint8(pos);break;case 1:out=view.getInt8(pos);break;case 3:out=view.getInt16(pos,little);break;case 4:case 11:out=view.getUint16(pos,little);break;case 5:out=view.getInt32(pos,little);break;case 6:case 12:out=view.getUint32(pos,little);break;case 8:out=view.getFloat32(pos,little);break;case 9:out=view.getFloat64(pos,little);break;case 7:{let a=new Uint8Array(view.buffer,view.byteOffset+pos,size);out=new TextDecoder().decode(a).split('\0')[0];break;}default:return null;}}catch{return null;}
  if(typeof out==='number'&&(!Number.isFinite(out)||base===2&&out===255||base===4&&out===65535||base===6&&out===4294967295||base===1&&out===127||base===3&&out===32767||base===5&&out===2147483647))return null;return out;}
function parseFIT(buffer){let v=new DataView(buffer),length=v.byteLength;if(length<16||![12,14].includes(v.getUint8(0))||String.fromCharCode(...new Uint8Array(buffer,8,4))!=='.FIT')throw Error('Not a valid FIT activity file.');const start=v.getUint8(0),size=v.getUint32(4,true),end=start+size;if(end>length||size>16000000)throw Error('Invalid or oversized FIT data section.');
  let defs={},off=start,pts=[],session={},lap=[],firstTs=null;let lastTimestamp=0;
  while(off<end){const h=v.getUint8(off++),compressed=!!(h&128),local=compressed?((h>>5)&3):(h&15);if(!compressed&&(h&64)){
      if(off+5>end)throw Error('Invalid FIT definition.');off++;const little=v.getUint8(off++)===0,global=v.getUint16(off,little);off+=2;const count=v.getUint8(off++),fields=[];for(let j=0;j<count;j++){if(off+3>end)throw Error('Truncated FIT field definition.');fields.push({n:v.getUint8(off),size:v.getUint8(off+1),type:v.getUint8(off+2)});off+=3;}if(h&32){if(off>=end)throw Error('Truncated FIT developer field list.');const c=v.getUint8(off++);off+=c*3;}defs[local]={fields,little,global};if(off>end)throw Error('Invalid FIT definition size.');continue;
    }
    const def=defs[local];if(!def)throw Error('FIT activity has an undefined message type.');const fields={};for(const f of def.fields){if(off+f.size>end)throw Error('Truncated FIT message.');fields[f.n]=fitValue(v,off,f.size,f.type,def.little);off+=f.size;}
    if(compressed && fields[253]==null){let next=(lastTimestamp&~31)+(h&31);if(next<lastTimestamp)next+=32;fields[253]=next;}
    if(Number.isFinite(fields[253]))lastTimestamp=fields[253];
    if(def.global===20){const t=Number.isFinite(fields[253])?EPOCH/1000+fields[253]:null;let lat=fields[0]===null||fields[0]===undefined?null:fields[0]*180/2147483648,lon=fields[1]===null||fields[1]===undefined?null:fields[1]*180/2147483648;let ele=fields[78]??fields[2];ele=ele==null?null:ele/5-500;
      if(t!==null){pts.push({t,lat:sane(lat,-90,90),lon:sane(lon,-180,180),ele,dist:fields[5]==null?null:fields[5]/100,hr:sane(fields[3],35,245),cadence:sane(fields[4],25,250)});if(firstTs===null)firstTs=t;}
    }else if(def.global===18){if(fields[9]!=null)session.distance=fields[9]/100;if(fields[8]!=null)session.duration=fields[8]/1000;if(fields[16]!=null)session.hr=fields[16];if(fields[18]!=null)session.cadence=fields[18];if(fields[22]!=null)session.elevation=fields[22];if(fields[13]!=null)session.date=asDate(fields[2]);}
    else if(def.global===19){if(fields[9]!=null&&fields[8]!=null)lap.push({km:fields[9]/1000,secs:fields[8]/1000});}
  }
  if(!pts.length&&(!session.date||!session.distance))throw Error('FIT file has no usable activity records.');
  if(!session.date&&firstTs)session.date=new Date(firstTs*1000).toISOString().slice(0,10);
  const result=finalize(pts,session);if(lap.length&&!JSON.parse(result.splits).length)result.splits=JSON.stringify(lap.map((l,i)=>({km:+(lap.slice(0,i+1).reduce((s,x)=>s+x.km,0)).toFixed(2),secs:Math.round(l.secs)})));
  return [result];
}
async function parse(file){if(!file||file.size>15*1024*1024)throw Error('Maximum file size is 15 MB.');const ext=file.name.split('.').at(-1).toLowerCase();let activities;if(ext==='fit')activities=parseFIT(await file.arrayBuffer());else if(ext==='gpx')activities=parseGPX(await file.text());else if(ext==='csv')activities=csvRows(await file.text());else throw Error('Use a .fit, .gpx or .csv file.');let ab=await file.arrayBuffer();let hash;
  if(crypto?.subtle?.digest){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',ab));hash=Array.from(bytes.slice(0,12),x=>x.toString(16).padStart(2,'0')).join('');}
  else {let h=2166136261;for(const b of new Uint8Array(ab)){h=Math.imul(h^b,16777619);}hash=(h>>>0).toString(16);}
  return activities.map((a,i)=>({...a,sourceId:`${hash}-${i}`,sourceFile:file.name,source:ext.toUpperCase()+' import'}));
}
return {parse,parseGPX,parseFIT,csvRows,haversine};
})();
