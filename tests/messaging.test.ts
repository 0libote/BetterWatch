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
