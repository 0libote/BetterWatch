import { test } from 'bun:test';
import assert from 'node:assert/strict';

Object.assign(globalThis, {
  chrome: {runtime: {id: 'test'}},
  browser: {runtime: {
    id: 'test', getURL: () => 'chrome-extension://test/', getManifest: () => ({manifest_version: 3}),
  }, storage: {session: {}}},
});
require('../src/services/services');
const {Shared} = require('../src/common/Shared') as typeof import('../src/common/Shared');
const {Requests, withHeaders} = require('../src/common/Requests') as typeof import('../src/common/Requests');
const {RequestsManager} = require('../src/common/RequestsManager') as typeof import('../src/common/RequestsManager');
Shared.pageType = 'background';
Shared.storage = {options: {grantCookies: false}} as typeof Shared.storage;

test('background requests include session cookies while preserving API headers and body', async () => {
  const original = globalThis.fetch;
  const calls: {url: string, options: RequestInit}[] = [];
  globalThis.fetch = (async (url: string, options: RequestInit) => {
    calls.push({url, options});
    return new Response('{"ok":true}', {status: 200});
  }) as typeof fetch;
  try {
    await Requests.send({url: 'https://www.netflix.com/settings/viewed/', method: 'GET'}, null);
    const trakt = withHeaders({'Authorization': 'Bearer fixture', 'trakt-api-key': 'fixture-client'});
    assert.equal(await trakt.send({url: 'https://api.trakt.tv/scrobble/start', method: 'POST', body: {progress: 25}}, null), '{"ok":true}');
    assert.equal(calls[0].options.credentials, 'include');
    assert.equal(calls[1].options.credentials, 'omit');
    assert.equal((calls[1].options.headers as Record<string, string>).Authorization, 'Bearer fixture');
    assert.equal((calls[1].options.headers as Record<string, string>)['trakt-api-key'], 'fixture-client');
    assert.equal(calls[1].options.body, '{"progress":25}');
  } finally {globalThis.fetch = original; RequestsManager.abortControllers.clear();}
});

test('canceling a tab aborts its in-flight request and a retry gets a fresh signal', async () => {
  const original = globalThis.fetch;
  let started!: () => void;
  const pending = new Promise<void>(resolve => {started = resolve;});
  globalThis.fetch = (async (_url: string, options: RequestInit) => {
    started();
    return new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
  }) as typeof fetch;
  try {
    const request = Requests.send({url: 'https://www.netflix.com/history', method: 'GET'}, 42);
    const rejected = assert.rejects(request);
    await pending;
    RequestsManager.cancelTabRequests(42);
    await rejected;
    globalThis.fetch = (async (_url: string, options: RequestInit) => {
      assert.equal(options.signal?.aborted, false);
      return new Response('retry worked');
    }) as typeof fetch;
    assert.equal(await Requests.send({url: 'https://www.netflix.com/history', method: 'GET'}, 42), 'retry worked');
  } finally {globalThis.fetch = original; RequestsManager.abortControllers.clear();}
});

test('browser cookies stay off for API and lookalike hosts, and Firefox keeps its existing permission path', async () => {
  const originalFetch = globalThis.fetch;
  const originalBrowser = Shared.browser;
  let credentials: RequestCredentials | undefined;
  globalThis.fetch = (async (_url: string, options: RequestInit) => {
    credentials = options.credentials;
    return new Response('ok');
  }) as typeof fetch;
  try {
    for (const url of ['https://api.trakt.tv/users/settings','https://www.netflix.com.evil.test/','https://www.netflixXcom/']) {
      await Requests.fetch({url,method:'GET'},null);
      assert.equal(credentials,'omit',url);
    }
    Shared.browser = 'firefox';
    await Requests.fetch({url:'https://www.netflix.com/history',method:'GET'},null);
    assert.equal(credentials,'omit');
  } finally {globalThis.fetch = originalFetch; Shared.browser = originalBrowser; RequestsManager.abortControllers.clear();}
});
