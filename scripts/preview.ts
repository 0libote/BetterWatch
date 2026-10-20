// Development UI harness only. No Chrome API shim is included in the extension.
import path from 'node:path';
export async function startPreview(
  root: string,
  port = 4173,
  hostname = '0.0.0.0',
) {
  const manifest = await Bun.file(path.join(root, 'manifest.json')).json();
  const messages = await Bun.file(
    path.join(root, '_locales/en/messages.json'),
  ).text();
  const shim = `<script>
(()=>{
 const messages=${messages};
 const manifest=${JSON.stringify(manifest)};
 const event=()=>{const listeners=new Set();return {addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f),hasListener:f=>listeners.has(f),emit:(...args)=>listeners.forEach(f=>f(...args))}};
 const changed=event();
 const store={version:14,...JSON.parse(localStorage.getItem('betterwatch-preview')||'{}')};
 const local={async get(keys){return keys?Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,store[k]])):{...store}},async set(values){const changes={};for(const [k,v] of Object.entries(values)){changes[k]={oldValue:store[k],newValue:v};store[k]=v}localStorage.setItem('betterwatch-preview',JSON.stringify(store));changed.emit(changes,'local')},async remove(keys){for(const k of Array.isArray(keys)?keys:[keys])delete store[k];localStorage.setItem('betterwatch-preview',JSON.stringify(store))},async clear(){for(const k of Object.keys(store))delete store[k]}};
 const api={runtime:{id:'preview',getURL:p=>p==='/'?'chrome-extension://preview/':new URL(p,location.href).href,getManifest:()=>manifest,onMessage:event(),sendMessage:async(message)=>{if(message.action==='get-tab-id')return 1;if(message.action==='validate-trakt-token')return store.auth||null;if(message.action==='login')throw new Error('Trakt sign-in requires the installed Chrome extension.');if(message.action==='send-request')throw new Error('Live requests require the installed Chrome extension.');return null;},openOptionsPage:async()=>{location.href='/app.html#/settings'}},identity:{getRedirectURL:()=> 'https://your-extension-id.chromiumapp.org/'},storage:{local,sync:{get:async()=>({}),set:async()=>{},remove:async()=>{},clear:async()=>{},QUOTA_BYTES_PER_ITEM:8192},session:local,onChanged:changed},tabs:{query:async()=>[],create:async({url})=>{location.href=url},onUpdated:event(),onRemoved:event()},permissions:{contains:async()=>true,request:async()=>true,remove:async()=>true},i18n:{getMessage:(name,subs)=>{const entry=messages[name];let text=entry?.message||name;for(const [key,value] of Object.entries(entry?.placeholders||{})){text=text.split('$'+key.toUpperCase()+'$').join(value.content).split('$'+key.toLowerCase()+'$').join(value.content)}for(const [i,value] of [subs].flat().entries())text=text.replaceAll('$'+(i+1),value||'');return text}}};
 window.chrome=api;window.browser=api;
})();</script>`;
  return Bun.serve({
    hostname,
    port,
    async fetch(request) {
      const pathname = new URL(request.url).pathname;
      let decoded: string;
      try {
        decoded = decodeURIComponent(pathname);
      } catch {
        return new Response('Malformed path', { status: 400 });
      }
      const filePath = path.resolve(
        root,
        '.' + (decoded === '/' ? '/app.html' : decoded),
      );
      if (!filePath.startsWith(root + path.sep))
        return new Response('Forbidden', { status: 403 });
      const file = Bun.file(filePath);
      if (!(await file.exists()))
        return new Response('Build the extension with bun run build first.', {
          status: 404,
        });
      if (path.extname(filePath) === '.html') {
        const html = (await file.text()).replace(
          '<script src=',
          () => shim + '<script src=',
        );
        return new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return new Response(file);
    },
  });
}
if (import.meta.main) {
  const server = await startPreview(
    path.resolve(import.meta.dir, '../build/chrome'),
    Number(process.env.PORT || 4173),
  );
  console.log(
    `UI preview: http://localhost:${server.port} (mock Chrome APIs; no real Trakt or streaming connection)`,
  );
}
