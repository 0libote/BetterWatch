import { test } from 'bun:test';
import assert from 'node:assert/strict';

type Listener = (message: unknown, sender: { tab?: { id: number } }) => Promise<unknown> | void;
let listener: Listener;
Object.assign(globalThis, {
  chrome: { runtime: { id: 'test' } },
  browser: {
    runtime: {
      id: "test",
      getURL: () => 'chrome-extension://test/',
      getManifest: () => ({ manifest_version: 3 }),
      onMessage: { addListener(value: Listener) { listener = value; } },
    },
    storage: { session: {} },
  },
});
const { Shared } = require('../src/common/Shared') as typeof import('../src/common/Shared');
const { Messaging } = require('../src/common/Messaging') as typeof import('../src/common/Messaging');
Shared.pageType = 'extension';
Shared.errors = { log() {} } as unknown as typeof Shared.errors;
Messaging.addListeners();

test('malformed, unknown, and inherited action names do not claim a message response', () => {
  for (const value of [null, 3, 'login', {}, { action: 3 }, { action: 'unknown' }, { action: 'toString' }, { action: 'constructor' }]) {
    assert.equal(listener(value, {}), undefined);
  }
});

test('registered handlers receive the sender tab and retain asynchronous responses', async () => {
  Messaging.addHandlers({ 'get-tab-id': async (_message, tabId) => tabId });
  assert.equal(await listener({ action: 'get-tab-id' }, { tab: { id: 42 } }), 42);
  assert.equal(await listener({ action: 'get-tab-id' }, {}), null);
});

test('a handler returning undefined leaves the response available to another extension context', () => {
  let calls = 0;
  Messaging.addHandlers({ 'set-title': () => { calls++; return undefined; } });
  assert.equal(listener({ action: 'set-title', title: 'Test' }, {}), undefined);
  assert.equal(calls, 1);
});

test('asynchronous handler errors retain the serialized messaging error format', async () => {
  Messaging.addHandlers({ logout: async () => { throw new Error('Test failure'); } });
  await assert.rejects(Promise.resolve(listener({ action: 'logout' }, {})), error => {
    assert.deepEqual(JSON.parse((error as Error).message), { instance: 'Error', data: { message: 'Test failure' } });
    return true;
  });
});

test('a disconnected tab cannot block a broadcast to remaining players', async () => {
  const {SessionStorage} = require('../src/common/SessionStorage') as typeof import('../src/common/SessionStorage');
  const originalArea = SessionStorage.instance;
  const originalSend = Messaging.toContent;
  const originalPage = Shared.pageType;
  const data = {injectedContentScriptTabs: [1,2]};
  SessionStorage.instance = {
    async get() {return {injectedContentScriptTabs: [...data.injectedContentScriptTabs]};},
    async set(value: typeof data) {Object.assign(data, value);},
  } as never;
  const sent: number[] = [];
  Shared.pageType = 'background';
  Messaging.toContent = async (_message, tabId) => {
    sent.push(tabId);
    if (tabId === 1) throw new Error('Receiving end does not exist');
    return null as never;
  };
  try {
    await Messaging.toAllContent({action: 'get-tab-id'});
    assert.deepEqual(sent, [1,2]);
    assert.deepEqual(data.injectedContentScriptTabs, [2]);
  } finally {SessionStorage.instance = originalArea; Messaging.toContent = originalSend; Shared.pageType = originalPage;}
});

test('closing a tab dispatches cleanup even if its injection reservation is still pending', async () => {
  let removed!: (id: number) => Promise<void>;
  const fake = (globalThis as any).browser;
  fake.tabs = {onRemoved: {hasListener: () => false, addListener(fn: typeof removed) {removed = fn;}}};
  const originalPage = Shared.pageType;
  const originalWait = Shared.waitForInit;
  const originalEvents = Shared.events;
  const cleaned: number[] = [];
  Shared.pageType = 'background';
  Shared.waitForInit = async () => {};
  Shared.events = {dispatch: async (_event: string, _specifier: null, data: {tabId: number}) => {cleaned.push(data.tabId);}} as never;
  try {
    Messaging.addListeners();
    await removed(42);
    assert.deepEqual(cleaned, [42]);
  } finally {Shared.pageType = originalPage; Shared.waitForInit = originalWait; Shared.events = originalEvents;}
});
