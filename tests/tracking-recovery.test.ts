import { beforeEach, test } from 'bun:test';
import assert from 'node:assert/strict';

const local: Record<string, any> = {};
const area = {
  async get(keys?: string | string[]) {return keys ? Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, structuredClone(local[key])])) : structuredClone(local);},
  async set(values: Record<string, any>) {Object.assign(local, structuredClone(values));},
  async remove(keys: string | string[]) {for (const key of Array.isArray(keys) ? keys : [keys]) delete local[key];},
};
Object.assign(globalThis, {chrome: {runtime: {id:'test'}}, browser: {
  runtime: {id:'test', getURL: () => 'chrome-extension://test/', getManifest: () => ({manifest_version:3})},
  storage: {local:area, sync:{...area,async get(){return {};},async set(){},async remove(){}},session:area},
  identity: {getRedirectURL: () => 'https://test.chromiumapp.org/'},
}});
const {Shared} = require('../src/common/Shared') as typeof import('../src/common/Shared');
const {BrowserStorage} = require('../src/common/BrowserStorage') as typeof import('../src/common/BrowserStorage');
const {ScrobbleEvents} = require('../src/common/ScrobbleEvents') as typeof import('../src/common/ScrobbleEvents');
const {ScrobbleController} = require('../src/common/ScrobbleController') as typeof import('../src/common/ScrobbleController');
const {TraktScrobble} = require('../src/apis/TraktScrobble') as typeof import('../src/apis/TraktScrobble');
const {TraktSearch} = require('../src/apis/TraktSearch') as typeof import('../src/apis/TraktSearch');
const {MovieItem} = require('../src/models/Item') as typeof import('../src/models/Item');
const {TraktMovieItem} = require('../src/models/TraktItem') as typeof import('../src/models/TraktItem');
const {RequestsManager} = require('../src/common/RequestsManager') as typeof import('../src/common/RequestsManager');
const timers = new Map<number, {fn: () => void, delay: number}>();
const notifications: string[] = [];
const listeners: Record<string, Function[]> = {};
const requests: {path:string, token:string|undefined, body:any}[] = [];
let nextTimer = 0;
let failPath: string | null = null;
const token = () => ({access_token:'fixture-token',refresh_token:'fixture-refresh',created_at:Math.floor(Date.now()/1000),expires_in:3600});

beforeEach(() => {
  for (const key of Object.keys(local)) delete local[key];
  for (const key of Object.keys(listeners)) delete listeners[key];
  timers.clear();requests.length=0;notifications.length=0;failPath=null;
  local.auth = token();local.traktApp = {clientId:'fixture-id',clientSecret:'fixture-secret'};
  Shared.pageType='background';Shared.tabId=42;Shared.storage=BrowserStorage;
  BrowserStorage.options={services:{netflix:{scrobble:true}},grantCookies:false} as never;
  Shared.errors={validate: () => true,log() {}} as never;
  Shared.events={subscribe(event:string,_specifier:null,fn:Function){(listeners[event]??=[]).push(fn);},unsubscribe(){},async dispatch(event:string){notifications.push(event);}} as never;
  Object.assign(globalThis,{window:{location:{href:'https://www.netflix.com/watch/123'},setTimeout(fn:()=>void,delay:number){const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout(id:number){timers.delete(id);}},document:{addEventListener(){},removeEventListener(){}}});
  globalThis.fetch=(async (url:string, options:RequestInit) => {
    const path=new URL(url).pathname;
    requests.push({path,token:(options.headers as Record<string,string>).Authorization,body:options.body?JSON.parse(options.body as string):null});
    if (path===failPath) return new Response('temporary failure',{status:503});
    if (path==='/search/movie') return Response.json([{movie:{title:'Fixture',year:2020,ids:{trakt:999,tmdb:888},released:'2020-01-01'}}]);
    if (path==='/oauth/token') return Response.json({...token(),access_token:'refreshed-token'});
    return Response.json({action:path.split('/').pop()});
  }) as typeof fetch;
  RequestsManager.abortControllers.clear();
});
function setup() {
  const item=new MovieItem({serviceId:'netflix',id:'123',title:'Fixture',year:2020,progress:25});
  item.trakt=new TraktMovieItem({id:999,tmdbId:888,title:'Fixture',year:2020});
  let stored: typeof item | null=item;
  let playback={isPaused:false,progress:25};
  const parser={api:{id:'netflix'},options:{},onClick:null,getItem:()=>stored,clearItem(){stored=null;},async parsePlayback(){stored??=item;return playback;}};
  const controller=new ScrobbleController(parser as never);
  const events=new ScrobbleEvents(controller);
  return {item,parser,controller,events,setPlayback(value:typeof playback){playback=value;}};
}
async function tick(events: InstanceType<typeof ScrobbleEvents>) {
  const [id,timer]=[...timers][0];timers.delete(id);timer.fn();await events.checkListeners();
}

test('failed starts preserve local state and retry with backoff until the server recovers', async () => {
  const {events}=setup();failPath='/scrobble/start';
  await events.checkListeners();
  assert.equal(local.scrobblingDetails,undefined);
  assert.ok(notifications.includes('SCROBBLE_ERROR'));
  assert.equal([...timers.values()][0].delay,1000);
  await tick(events);assert.equal([...timers.values()][0].delay,2000);
  failPath=null;await tick(events);
  assert.equal((await area.get('scrobblingDetails')).scrobblingDetails.isPaused,false);
  assert.equal([...timers.values()][0].delay,500);
  assert.equal(requests.filter(x=>x.path==='/scrobble/start').length,3);
});

test('failed pause requests do not claim success and retry the same transition', async () => {
  const {events,setPlayback}=setup();await events.checkListeners();
  setPlayback({isPaused:true,progress:25});failPath='/scrobble/pause';await tick(events);
  assert.equal(local.scrobblingDetails.isPaused,false);
  failPath=null;await tick(events);
  assert.equal(local.scrobblingDetails.isPaused,true);
  assert.equal(requests.filter(x=>x.path==='/scrobble/pause').length,2);
});

test('a parser exception cannot kill polling for the rest of the tab session', async () => {
  const {events,parser}=setup();const original=parser.parsePlayback;
  parser.parsePlayback=async()=>{throw new Error('player not ready');};await events.checkListeners();
  assert.equal(timers.size,1);
  parser.parsePlayback=original;await tick(events);
  assert.equal(local.scrobblingDetails.item.id,'123');
});

test('turning tracking off sends stop, clears the watch, and starts one loop when re-enabled', async () => {
  const {events}=setup();await events.checkListeners();
  BrowserStorage.options.services.netflix.scrobble=false;
  await events.onStorageOptionsChange({options:{services:{netflix:{scrobble:false}}}});
  assert.equal(local.scrobblingDetails,undefined);assert.equal(timers.size,0);
  assert.equal(requests.at(-1)?.path,'/scrobble/stop');
  BrowserStorage.options.services.netflix.scrobble=true;
  await events.onStorageOptionsChange({options:{services:{netflix:{scrobble:true}}}});
  assert.equal(requests.at(-1)?.path,'/scrobble/start');assert.equal(timers.size,1);
});

test('disable/re-enable during a pending parse does not revive the old polling loop', async () => {
  const {events,parser}=setup();
  let release!:()=>void;let entered!:()=>void;
  const started=new Promise<void>(resolve=>{entered=resolve;});
  const pending=new Promise<void>(resolve=>{release=resolve;});
  const original=parser.parsePlayback;let parses=0;
  parser.parsePlayback=async()=>{if(++parses===1){entered();await pending;}return original();};
  const first=events.checkListeners();await started;
  BrowserStorage.options.services.netflix.scrobble=false;const disabled=events.checkListeners();
  BrowserStorage.options.services.netflix.scrobble=true;const enabled=events.checkListeners();
  release();await Promise.all([first,disabled,enabled]);
  assert.equal(timers.size,1);assert.equal(parses,2);
  assert.equal(requests.filter(x=>x.path==='/scrobble/start').length,1);
});

test('an expired token is refreshed during ongoing playback before the next transition', async () => {
  const {events,setPlayback}=setup();await events.checkListeners();
  local.auth.created_at=1;local.auth.expires_in=1;
  setPlayback({isPaused:true,progress:25});await tick(events);
  assert.equal(requests.filter(x=>x.path==='/oauth/token').length,1);
  assert.equal(requests.at(-1)?.token,'Bearer refreshed-token');
});

test('temporary title matching errors do not permanently blacklist the current title', async () => {
  const {events,item}=setup();delete item.trakt;
  const original=TraktSearch.find;let lookups=0;
  TraktSearch.find=async()=>{if(++lookups===1)throw new Error('temporary outage');return new TraktMovieItem({id:999,tmdbId:888,title:'Fixture',year:2020});};
  try {
    await events.checkListeners();assert.equal(item.trakt,undefined);
    await tick(events);assert.equal(local.scrobblingDetails.item.trakt.id,999);assert.equal(lookups,2);
  } finally {TraktSearch.find=original;}
});

test('an inactive tab cannot pause or remove the watch owned by another tab', async () => {
  const {item}=setup();await TraktScrobble.start(item);
  Shared.tabId=7;await TraktScrobble.pause(item);await TraktScrobble.stop(item);
  assert.equal(local.scrobblingDetails.tabId,42);assert.equal(local.scrobblingDetails.isPaused,false);
  assert.deepEqual(requests.map(x=>x.path),['/scrobble/start']);
});

test('a failed stop keeps the watch available for a later retry', async () => {
  const {item}=setup();await TraktScrobble.start(item);failPath='/scrobble/stop';
  await assert.rejects(TraktScrobble.stop(item));assert.ok(local.scrobblingDetails);
  failPath=null;await TraktScrobble.stop(item);assert.equal(local.scrobblingDetails,undefined);
});

test('correcting the active title keeps its playback progress and ignores unrelated watches', async () => {
  const {item,controller,events}=setup();controller.init();await events.checkListeners();
  const correct=listeners.SCROBBLING_ITEM_CORRECTED[0];
  const corrected=new TraktMovieItem({id:777,tmdbId:666,title:'Corrected',year:2020});
  await correct({oldItem:{...item.save(),id:'unrelated'},newItem:{...item.save(),trakt:corrected.save()}});
  assert.equal(requests.length,1);
  await correct({oldItem:item.save(),newItem:{...item.save(),trakt:corrected.save()}});
  assert.equal(requests.at(-1)?.body.movie.ids.trakt,777);
  assert.equal(requests.at(-1)?.body.progress,25);
  assert.equal(local.scrobblingDetails.item.trakt.id,777);
});

test('repeated tracking failures back off to a bounded delay', async () => {
  const {events}=setup();failPath='/scrobble/start';await events.checkListeners();
  for(let i=0;i<8;i++) await tick(events);
  assert.equal(timers.size,1);assert.equal([...timers.values()][0].delay,30000);
});

test('disabling during an in-flight start waits for it and then stops the accepted watch', async () => {
  const {events}=setup();const original=globalThis.fetch;
  let release!:()=>void;let entered!:()=>void;
  const started=new Promise<void>(resolve=>{entered=resolve;});
  const pending=new Promise<void>(resolve=>{release=resolve;});
  globalThis.fetch=(async (url:string,options:RequestInit)=>{if(new URL(url).pathname==='/scrobble/start'){entered();await pending;}return original(url,options);}) as typeof fetch;
  const first=events.checkListeners();await started;
  BrowserStorage.options.services.netflix.scrobble=false;const disabled=events.checkListeners();
  release();await Promise.all([first,disabled]);
  assert.deepEqual(requests.map(x=>x.path),['/scrobble/start','/scrobble/stop']);
  assert.equal(local.scrobblingDetails,undefined);assert.equal(timers.size,0);
});

test('a stop finishing late cannot remove the watch started in another tab', async () => {
  const {item}=setup();await TraktScrobble.start(item);
  const original=globalThis.fetch;let release!:()=>void;let entered!:()=>void;
  const started=new Promise<void>(resolve=>{entered=resolve;});
  const pending=new Promise<void>(resolve=>{release=resolve;});
  globalThis.fetch=(async (url:string,options:RequestInit)=>{if(new URL(url).pathname==='/scrobble/stop'){entered();await pending;}return original(url,options);}) as typeof fetch;
  const stopping=TraktScrobble.stop(item);await started;
  local.scrobblingDetails={tabId:7,item:{...item.save(),id:'456'},isPaused:false};
  release();await stopping;
  assert.equal(local.scrobblingDetails.tabId,7);assert.equal(local.scrobblingDetails.item.id,'456');
});

test('matching a new title refreshes an expired token before search, not only before scrobbling', async () => {
  const {events,item}=setup();delete item.trakt;
  local.auth.created_at=1;local.auth.expires_in=1;
  await events.checkListeners();
  assert.equal(requests.find(request=>request.path==='/search/movie')?.token,'Bearer refreshed-token');
  assert.equal(local.scrobblingDetails.item.trakt.id,999);
});
