// Development UI harness only. No Chrome API shim is included in the extension.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../build/chrome');
const messages = fs.readFileSync(path.join(root,'_locales/en/messages.json'),'utf8');
const shim = `<script>
(()=>{
 const messages=${messages};
 const event=()=>{const listeners=new Set();return {addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f),hasListener:f=>listeners.has(f),emit:(...args)=>listeners.forEach(f=>f(...args))}};
 const changed=event();
 const store={version:14,...JSON.parse(localStorage.getItem('betterwatch-preview')||'{}')};
 const local={async get(keys){return keys?Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,store[k]])):{...store}},async set(values){const changes={};for(const [k,v] of Object.entries(values)){changes[k]={oldValue:store[k],newValue:v};store[k]=v}localStorage.setItem('betterwatch-preview',JSON.stringify(store));changed.emit(changes,'local')},async remove(keys){for(const k of Array.isArray(keys)?keys:[keys])delete store[k];localStorage.setItem('betterwatch-preview',JSON.stringify(store))},async clear(){for(const k of Object.keys(store))delete store[k]}};
 const api={runtime:{id:'preview',getURL:p=>p==='/'?'chrome-extension://preview/':new URL(p,location.href).href,getManifest:()=>({manifest_version:3,version:'0.1.0'}),onMessage:event(),sendMessage:async()=>null,openOptionsPage:async()=>{location.href='/options.html'}},identity:{getRedirectURL:()=> 'https://your-extension-id.chromiumapp.org/'},storage:{local,sync:{get:async()=>({}),set:async()=>{},remove:async()=>{},clear:async()=>{},QUOTA_BYTES_PER_ITEM:8192},session:local,onChanged:changed},tabs:{query:async()=>[],create:async({url})=>{location.href=url},onUpdated:event(),onRemoved:event()},permissions:{contains:async()=>true,request:async()=>true},i18n:{getMessage:(name,subs)=>{let text=messages[name]?.message||name;for(const [i,value] of [subs].flat().entries())text=text.replaceAll('$'+(i+1),value||'');return text}}};
 window.chrome=api;window.browser=api;
})();</script>`;
http.createServer((req,res)=>{
 const name = new URL(req.url || '/','http://localhost').pathname === '/' ? '/popup.html' : new URL(req.url || '/','http://localhost').pathname;
 const file = path.resolve(root,'.'+name);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
 try{
 let data = /** @type {Buffer | string} */ (fs.readFileSync(file));
 const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2'})[ext]||'application/octet-stream');
 if(ext==='.html')data=data.toString().replace('<script src=',() => shim+'<script src=');
 res.end(data);
 }catch{res.writeHead(404);res.end('Build the extension with npm run build first.')}
}).listen(4173,'0.0.0.0',()=>console.log('UI preview: http://localhost:4173 (mock Chrome APIs; no real Trakt or streaming connection)'));
