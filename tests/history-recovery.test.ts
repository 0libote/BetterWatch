import { beforeEach, test } from 'bun:test';
import assert from 'node:assert/strict';

Object.assign(globalThis, {
  chrome: { runtime: { id: 'test' } },
  browser: { runtime: {
    id: 'test', getURL: () => 'chrome-extension://test/', getManifest: () => ({ manifest_version: 3 }),
  }, storage: { session: {} } },
});
require('../src/services/services');
const { Shared } = require('../src/common/Shared') as typeof import('../src/common/Shared');
require('../src/common/Errors');
const { EventDispatcher } = require('../src/common/Events') as typeof import('../src/common/Events');
const { RequestError } = require('../src/common/RequestError') as typeof import('../src/common/RequestError');
const { Requests } = require('../src/common/Requests') as typeof import('../src/common/Requests');
const { Cache } = require('../src/common/Cache') as typeof import('../src/common/Cache');
const { ServiceApi } = require('../src/apis/ServiceApi') as typeof import('../src/apis/ServiceApi');
const { TraktSync } = require('../src/apis/TraktSync') as typeof import('../src/apis/TraktSync');
const { AutoSync } = require('../src/common/AutoSync') as typeof import('../src/common/AutoSync');
const { NetflixApi } = require('../src/services/netflix/NetflixApi') as typeof import('../src/services/netflix/NetflixApi');
const { MovieItem } = require('../src/models/Item') as typeof import('../src/models/Item');
const { SyncStore } = require('../src/stores/SyncStore') as typeof import('../src/stores/SyncStore');
const { getSyncStore } = require('../src/stores/SyncStore') as typeof import('../src/stores/SyncStore');

const canceledError = () => new RequestError({ status: -1, isCanceled: true });
const dispatched: { type: string; data: unknown }[] = [];
let savedOptions: unknown[] = [];
let savedCaches: unknown[] = [];

const movie = (id: string, selected: boolean) =>
  new MovieItem({
    serviceId: 'netflix',
    id,
    title: `Movie ${id}`,
    year: 2020,
    watchedAt: 1700000000,
    progress: 100,
    isSelected: selected,
    trakt: { id: Number(id.replace(/\D/g, '')) || 1, tmdbId: 1, title: `Movie ${id}`, year: 2020 },
  });

beforeEach(async () => {
  EventDispatcher.GLOBAL_EVENTS = [];
  EventDispatcher.listeners = {};
  dispatched.length = 0;
  savedOptions = [];
  savedCaches = [];
  EventDispatcher.subscribe('HISTORY_SYNC_SUCCESS', null, (data: unknown) => {
    dispatched.push({ type: 'HISTORY_SYNC_SUCCESS', data });
  });
  EventDispatcher.subscribe('HISTORY_SYNC_ERROR', null, (data: unknown) => {
    dispatched.push({ type: 'HISTORY_SYNC_ERROR', data });
  });
  Shared.pageType = 'background';
  Shared.storage = {
    options: { services: { netflix: { sync: true, lastSync: 1000, lastSyncId: 'm0' } }, grantCookies: false },
    syncOptions: { minPercentageWatched: 80, addWithReleaseDate: false, hideSynced: false },
    get: async () => ({}),
    set: async (values: unknown) => { savedCaches.push(values); },
    saveOptions: async (options: unknown) => { savedOptions.push(options); },
  } as unknown as typeof Shared.storage;
  for (const id of ['netflix', 'cancel-svc', 'trakt-cancel', 'trakt-fail']) {
    await getSyncStore(id).resetData();
  }
});

test('canceled Trakt sync rejects instead of resolving as success', async () => {
  const originalRequests = TraktSync.requests;
  const originalActivate = TraktSync.activate;
  const originalGet = Cache.get;
  const originalLoad = TraktSync.loadHistory;
  (Cache as any).get = async () => ({get(){},set(){}});
  TraktSync.loadHistory = async () => {};
  TraktSync.activate = async () => {};
  (TraktSync as any).requests = { send: async () => { throw canceledError(); } };
  try {
    const store = getSyncStore('trakt-cancel');
    await store.setData({ items: [movie('m1', true)] });
    await assert.rejects(TraktSync.sync(store, store.data.items, 'sync'), (err: unknown) => {
      assert.ok(err instanceof RequestError && err.isCanceled);
      return true;
    });
    // A canceled sync must stay silent: no success event, no error event, selection kept.
    assert.deepEqual(dispatched, []);
    assert.equal(store.data.items[0].isSelected, true);
  } finally {
    TraktSync.requests = originalRequests;
    TraktSync.activate = originalActivate;
    Cache.get = originalGet;
    TraktSync.loadHistory = originalLoad;
  }
});

test('failed Trakt sync rejects and keeps failed watches selected', async () => {
  const originalRequests = TraktSync.requests;
  const originalActivate = TraktSync.activate;
  const originalLoadHistory = TraktSync.loadHistory;
  const originalCacheGet = Cache.get;
  const originalCacheSet = Cache.set;
  TraktSync.activate = async () => {};
  (TraktSync as any).requests = {
    send: async () => JSON.stringify({
      added: { episodes: 0, movies: 2 },
      not_found: { episodes: [], movies: [] },
    }),
  };
  TraktSync.loadHistory = async (item: { id: string }) => {
    if (item.id === 'm2') {
      throw new Error('history boom');
    }
  };
  (Cache as any).get = async () => ({ get: () => undefined, set: () => {} });
  (Cache as any).set = async () => {};
  try {
    const store = getSyncStore('trakt-fail');
    await store.setData({ items: [movie('m1', true), movie('m2', true)] });
    await assert.rejects(TraktSync.sync(store, store.data.items, 'sync'), /history boom/);
    assert.equal(dispatched.filter((d) => d.type === 'HISTORY_SYNC_ERROR').length, 1);
    assert.equal(dispatched.filter((d) => d.type === 'HISTORY_SYNC_SUCCESS').length, 0);
    // The watch that loaded before the failure must not be silently deselected.
    assert.equal(store.data.items[0].isSelected, true);
    assert.equal(store.data.items[1].isSelected, true);
  } finally {
    TraktSync.requests = originalRequests;
    TraktSync.activate = originalActivate;
    TraktSync.loadHistory = originalLoadHistory;
    Cache.get = originalCacheGet;
    Cache.set = originalCacheSet;
  }
});

test('auto-sync does not advance lastSync when the import fails', async () => {
  const api = (await import('../src/apis/ServiceApi')).getServiceApi('netflix');
  const originalLoadHistory = api.loadHistory;
  const originalLoadTraktHistory = ServiceApi.loadTraktHistory;
  const originalTraktSync = TraktSync.sync;
  api.loadHistory = async () => {
    await getSyncStore('netflix').setData({ items: [movie('m1', false)] });
    return [];
  };
  ServiceApi.loadTraktHistory = async (items: unknown[]) => items as never;
  TraktSync.sync = async () => { throw new Error('trakt down'); };
  try {
    await (AutoSync as unknown as { sync: (s: unknown[], n: number) => Promise<void> })
      .sync([{ id: 'netflix' }], 2000);
    // saveOptions still runs, but it must not move lastSync forward.
    assert.ok(savedOptions.every((options) => !(options as { services?: unknown }).services));
    assert.equal(savedCaches.length, 1);
    assert.equal((savedCaches[0] as { syncCache: { failed: boolean } }).syncCache.failed, true);
  } finally {
    api.loadHistory = originalLoadHistory;
    ServiceApi.loadTraktHistory = originalLoadTraktHistory;
    TraktSync.sync = originalTraktSync;
  }
});

test('auto-sync advances lastSync on success but never on cancel', async () => {
  const api = (await import('../src/apis/ServiceApi')).getServiceApi('netflix');
  const originalLoadHistory = api.loadHistory;
  const originalLoadTraktHistory = ServiceApi.loadTraktHistory;
  const originalTraktSync = TraktSync.sync;
  api.loadHistory = async () => {
    await getSyncStore('netflix').setData({ items: [movie('m1', false)] });
    return [];
  };
  ServiceApi.loadTraktHistory = async (items: unknown[]) => items as never;
  TraktSync.sync = async (_store, items) => {for (const item of items) if (item.trakt) item.trakt.watchedAt = item.watchedAt;};
  try {
    await (AutoSync as unknown as { sync: (s: unknown[], n: number) => Promise<void> })
      .sync([{ id: 'netflix' }], 2000);
    assert.equal(savedOptions.length, 1);
    assert.equal(
      (savedOptions[0] as { services: { netflix: { lastSync: number } } }).services.netflix.lastSync,
      2000,
    );
  } finally {
    api.loadHistory = originalLoadHistory;
    ServiceApi.loadTraktHistory = originalLoadTraktHistory;
    TraktSync.sync = originalTraktSync;
    await getSyncStore('netflix').resetData();
  }
  savedOptions = [];
  const api2 = (await import('../src/apis/ServiceApi')).getServiceApi('netflix');
  const originalLoadHistory2 = api2.loadHistory;
  const originalLoadTraktHistory2 = ServiceApi.loadTraktHistory;
  api2.loadHistory = async () => {
    await getSyncStore('netflix').setData({ items: [movie('m1', false)] });
    return [];
  };
  ServiceApi.loadTraktHistory = async () => { throw canceledError(); };
  try {
    await (AutoSync as unknown as { sync: (s: unknown[], n: number) => Promise<void> })
      .sync([{ id: 'netflix' }], 2000);
    assert.ok(savedOptions.every((options) => !(options as { services?: unknown }).services));
  } finally {
    api2.loadHistory = originalLoadHistory2;
    ServiceApi.loadTraktHistory = originalLoadTraktHistory2;
  }
});

test('overlapping auto-sync runs do not run twice', async () => {
  const api = (await import('../src/apis/ServiceApi')).getServiceApi('netflix');
  const originalLoadHistory = api.loadHistory;
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  api.loadHistory = async () => { calls += 1; await gate; return []; };
  try {
    const sync = (AutoSync as unknown as { sync: (s: unknown[], n: number) => Promise<void> }).sync.bind(AutoSync);
    const first = sync([{ id: 'netflix' }], 2000);
    const second = sync([{ id: 'netflix' }], 2000);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(calls, 1);
    release();
    await Promise.all([first, second]);
    assert.equal(calls, 1);
  } finally {
    api.loadHistory = originalLoadHistory;
  }
});

test('canceled history load restores pagination so a retry refetches the same page', async () => {
  const originalCacheGet = Cache.get;
  const originalCacheSet = Cache.set;
  let cacheSets = 0;
  (Cache as any).get = async () => ({
    history: { get: () => ({ items: [] }), set: () => {} },
    historyItemsToItems: { get: () => undefined, set: () => {} },
    items: { get: () => undefined, set: () => {} },
  });
  (Cache as any).set = async () => { cacheSets += 1; };
  class CancelApi extends ServiceApi {
    calls = 0;
    constructor() { super('cancel-svc'); }
    override async loadHistoryItems(): Promise<unknown[]> {
      this.calls += 1;
      this.nextHistoryPage += 1;
      throw canceledError();
    }
    override isNewHistoryItem(): boolean { return true; }
    override getHistoryItemId(item: unknown): string { return String(item); }
    override convertHistoryItems(items: unknown[]): Promise<never[]> {
      return Promise.resolve(items as never[]);
    }
  }
  const api = new CancelApi();
  api.nextHistoryPage = 5;
  api.nextHistoryUrl = 'page-5';
  api.hasCheckedHistoryCache = true;
  (api as any).leftoverHistoryItems = ['left'];
  try {
    await assert.rejects(api.loadHistory(20, 0, '', 'k'), (err: unknown) => {
      assert.ok(err instanceof RequestError && err.isCanceled);
      return true;
    });
    assert.equal(api.nextHistoryPage, 5);
    assert.equal(api.nextHistoryUrl, 'page-5');
    assert.equal(api.hasCheckedHistoryCache, true);
    assert.deepEqual((api as any).leftoverHistoryItems, ['left']);
    assert.equal(cacheSets, 0);
    // A retry starts from the same spot instead of skipping ahead.
    await assert.rejects(api.loadHistory(20, 0, '', 'k'));
    assert.equal(api.calls, 2);
    assert.equal(api.nextHistoryPage, 5);
  } finally {
    Cache.get = originalCacheGet;
    Cache.set = originalCacheSet;
  }
});

test('canceled Netflix history fetch is not retried', async () => {
  const originalSend = Requests.send;
  const originalSession = NetflixApi.session;
  let calls = 0;
  Requests.send = async () => { calls += 1; throw canceledError(); };
  NetflixApi.session = { authUrl: 'x', profileName: 'p', userGuid: 'g' };
  try {
    await assert.rejects(
      (NetflixApi as unknown as { fetchHistoryItems: (...a: unknown[]) => Promise<unknown[]> })
        .fetchHistoryItems(0, 50, 'k', 10),
      (err: unknown) => {
        assert.ok(err instanceof RequestError && err.isCanceled);
        return true;
      },
    );
    assert.equal(calls, 1);
  } finally {
    Requests.send = originalSend;
    NetflixApi.session = originalSession;
  }
});

test('canceled Netflix metadata fetch does not fall through to the next URL', async () => {
  const originalSend = Requests.send;
  const originalSession = NetflixApi.session;
  let calls = 0;
  Requests.send = async () => { calls += 1; throw canceledError(); };
  NetflixApi.session = { authUrl: 'x', profileName: 'p', userGuid: 'g' };
  try {
    await assert.rejects(
      (NetflixApi as unknown as { fetchSingleMetadata: (id: string) => Promise<unknown> })
        .fetchSingleMetadata('123'),
      (err: unknown) => {
        assert.ok(err instanceof RequestError && err.isCanceled);
        return true;
      },
    );
    assert.equal(calls, 1);
  } finally {
    Requests.send = originalSend;
    NetflixApi.session = originalSession;
  }
});

test('retrying an accepted import with a failed response rechecks Trakt and does not write twice', async () => {
  const originalActivate=TraktSync.activate, originalRequests=TraktSync.requests, originalLoad=TraktSync.loadHistory;
  let accepted=false, writes=0, checks=0;
  TraktSync.activate=async()=>{};
  TraktSync.requests={send:async()=>{writes++;accepted=true;throw new RequestError({status:503});}} as never;
  TraktSync.loadHistory=async(item)=>{checks++;if(item.trakt)item.trakt.watchedAt=accepted?item.watchedAt:null;};
  const store=getSyncStore('retry');await store.resetData();await store.setData({items:[movie('m1',true)]});
  try {
    await assert.rejects(TraktSync.sync(store,store.data.items));
    assert.equal(store.data.items[0].isSelected,true);
    await TraktSync.sync(store,store.data.items);
    assert.equal(writes,1);assert.equal(checks,2);
    assert.equal(store.data.items[0].isSelected,false);
    assert.equal(store.data.items[0].trakt?.watchedAt,1700000000);
  } finally {TraktSync.activate=originalActivate;TraktSync.requests=originalRequests;TraktSync.loadHistory=originalLoad;}
});

test('partial not-found responses keep unmatched watches selected and do not report full success', async () => {
  const originalActivate=TraktSync.activate, originalRequests=TraktSync.requests, originalLoad=TraktSync.loadHistory;
  let posted=false;
  TraktSync.activate=async()=>{};
  TraktSync.requests={send:async()=>{posted=true;return JSON.stringify({added:{movies:1,episodes:0},not_found:{movies:[{ids:{trakt:2}}],episodes:[]}});}} as never;
  TraktSync.loadHistory=async(item)=>{if(item.trakt)item.trakt.watchedAt=posted&&item.id==='m1'?item.watchedAt:null;};
  const store=getSyncStore('partial');await store.resetData();await store.setData({items:[movie('m1',true),movie('m2',true)]});
  try {
    await assert.rejects(TraktSync.sync(store,store.data.items),/could not find/);
    assert.equal(store.data.items[0].isSelected,false);assert.equal(store.data.items[1].isSelected,true);
    assert.equal(dispatched.filter(event=>event.type==='HISTORY_SYNC_SUCCESS').length,0);
  } finally {TraktSync.activate=originalActivate;TraktSync.requests=originalRequests;TraktSync.loadHistory=originalLoad;}
});

test('scheduled failures remain available for review and a successful retry updates that watch once', async () => {
  const api=(await import('../src/apis/ServiceApi')).getServiceApi('netflix');
  const originalLoad=api.loadHistory, originalTraktLoad=ServiceApi.loadTraktHistory, originalSync=TraktSync.sync;
  const syncCache={items:[] as import('../src/models/Item').ScrobbleItemValues[],failed:false};
  Shared.storage.get=async()=>({syncCache});
  api.loadHistory=async()=>{await getSyncStore('netflix').setData({items:[movie('m1',false)]});return [];};
  ServiceApi.loadTraktHistory=async(items)=>items;
  TraktSync.sync=async()=>{throw new Error('offline');};
  const sync=(AutoSync as unknown as {sync:(s:unknown[],now:number)=>Promise<void>}).sync.bind(AutoSync);
  try {
    await sync([{id:'netflix'}],2000);
    assert.equal(syncCache.items.length,1);assert.equal(syncCache.items[0].id,'m1');
    assert.ok(savedOptions.every((value:any)=>!value.services));
    TraktSync.sync=async(_store,items)=>{for(const item of items)if(item.trakt)item.trakt.watchedAt=item.watchedAt;};
    await sync([{id:'netflix'}],3000);
    assert.equal(syncCache.items.length,1);assert.equal(syncCache.items[0].trakt?.watchedAt,1700000000);
    assert.equal((savedOptions.at(-1) as any).services.netflix.lastSync,3000);
  } finally {api.loadHistory=originalLoad;ServiceApi.loadTraktHistory=originalTraktLoad;TraktSync.sync=originalSync;}
});

test('a metadata outage restores the history cursor so retrying cannot skip that page', async () => {
  class OutageApi extends ServiceApi {
    constructor(){super('outage-svc');}
    override async loadHistoryItems(){this.nextHistoryPage++;return [1];}
    override prepareHistoryItems():never{throw new Error('metadata outage');}
  }
  const api=new OutageApi();api.nextHistoryPage=4;
  await assert.rejects(api.loadHistory(1,0,''),/metadata outage/);
  assert.equal(api.nextHistoryPage,4);assert.equal(api.hasCheckedHistoryCache,false);
  assert.equal(getSyncStore('outage-svc').data.items.length,0);
});

test('Netflix activation preserves cancellation rather than turning it into a login failure', async () => {
  const originalSession=NetflixApi.getSession, originalSend=Requests.send;
  let requests=0;
  NetflixApi.getSession=async()=>null;
  Requests.send=async()=>{requests++;throw canceledError();};
  try {
    await assert.rejects(NetflixApi.activate(),(err:unknown)=>err instanceof RequestError&&!!err.isCanceled);
    assert.equal(requests,1);
  } finally {NetflixApi.getSession=originalSession;Requests.send=originalSend;}
});
