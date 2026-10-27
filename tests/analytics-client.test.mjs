import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../web/analytics.js',import.meta.url),'utf8');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(options={}){
 const calls=[],beacons=[],timers=[],listeners={};
 const memory=()=>{const values=new Map();return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}};
 const storage=memory();
 const win={localStorage:storage,sessionStorage:memory(),navigator:{sendBeacon:(url,body)=>{beacons.push({url,body});return true}},addEventListener:(name,fn)=>listeners[name]=fn,setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout:()=>{},fetch:(url,init)=>{calls.push({url,...init});return Promise.resolve({ok:true,status:204})}};
 Object.defineProperties(win,Object.getOwnPropertyDescriptors(options));
 const doc={visibilityState:'visible',addEventListener:(name,fn)=>listeners[name]=fn};
 vm.runInNewContext(script,{window:win,document:doc,Uint8Array});
 return {win,doc,calls,beacons,timers,listeners};
}
test('legacy crypto produces valid IDs and a blocked storage getter does not suppress the open',async()=>{
 const {calls}=setup({get localStorage(){throw Error('blocked')},get sessionStorage(){throw Error('blocked')}});
 await flush();assert.equal(calls.length,1);const body=JSON.parse(calls[0].body);assert.match(body.id,uuid);assert.match(body.event,uuid);
});
test('missing randomUUID uses getRandomValues and persists the same device',async()=>{
 const values=new Map();const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 const crypto={getRandomValues:array=>{array.fill(17);return array}};
 const first=setup({crypto,localStorage:storage});await flush();const second=setup({crypto,localStorage:storage});await flush();
 assert.equal(JSON.parse(first.calls[0].body).id,JSON.parse(second.calls[0].body).id);assert.match(JSON.parse(first.calls[0].body).id,uuid);
});
test('fetch failure falls back to XMLHttpRequest and hidden-page beacon reuses the same event',async()=>{
 const requests=[];class XHR {open(method,url){this.url=url}setRequestHeader(){}send(body){requests.push(body)}}
 const state=setup({fetch:()=>Promise.reject(Error('unsupported keepalive')),XMLHttpRequest:XHR});await flush();
 assert.equal(requests.length,1);state.doc.visibilityState='hidden';state.listeners.visibilitychange();state.listeners.pagehide();
 assert.equal(state.beacons.length,2);assert.equal(state.beacons[0].body,requests[0]);assert.equal(state.beacons[1].body,requests[0]);
});
test('confirmed delivery suppresses beacon duplicates and mere foreground restoration adds no open',async()=>{
 const state=setup();await flush();state.doc.visibilityState='hidden';state.listeners.visibilitychange();state.listeners.pagehide();state.doc.visibilityState='visible';state.listeners.visibilitychange();
 assert.equal(state.calls.length,1);assert.equal(state.beacons.length,0);
});
test('server failure retries one event instead of generating a new page load',async()=>{
 const requests=[];const state=setup({fetch:(url,init)=>{requests.push(init.body);return Promise.resolve({ok:requests.length>1,status:requests.length>1?204:503})}});
 await flush();assert.equal(state.timers.length,1);state.timers[0]();await flush();assert.equal(requests.length,2);assert.equal(requests[0],requests[1]);
});
test('without fetch an older browser still posts through XMLHttpRequest',async()=>{
 const requests=[];class XHR {open(){}setRequestHeader(){}send(body){requests.push(body);this.status=204;this.onload()}}
 const state=setup({fetch:undefined,XMLHttpRequest:XHR});await flush();assert.equal(requests.length,1);state.listeners.pagehide();assert.equal(state.beacons.length,0);
});
