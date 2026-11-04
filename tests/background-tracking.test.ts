import { beforeEach, test } from 'bun:test';
import assert from 'node:assert/strict';
import type { Tabs } from 'webextension-polyfill';

const session: Record<string, any> = {};
const injected: number[] = [];
let updateListener: Function | undefined;
let failInjection = false;
const browser = {
  runtime: { id: 'test', getURL: () => 'chrome-extension://test/', getManifest: () => ({manifest_version: 3}) },
  storage: {session: {
    async get(key: string) { return {[key]: session[key] ? [...session[key]] : undefined}; },
    async set(values: Record<string, any>) {Object.assign(session, values);},
  }},
  tabs: {onUpdated: {addListener(listener: Function) {updateListener = listener;}}},
  scripting: {async executeScript({target}: {target: {tabId: number}}) {
    if (failInjection) throw new Error('Tab navigated');
    injected.push(target.tabId);
  }},
};
Object.assign(globalThis, {chrome: {runtime: {id: 'test'}}, browser});
const {Shared} = require('../src/common/Shared') as typeof import('../src/common/Shared');
const {ScriptInjector} = require('../src/common/ScriptInjector') as typeof import('../src/common/ScriptInjector');
const {SessionStorage} = require('../src/common/SessionStorage') as typeof import('../src/common/SessionStorage');
const {EventDispatcher} = require('../src/common/Events') as typeof import('../src/common/Events');
const {BrowserStorage} = require('../src/common/BrowserStorage') as typeof import('../src/common/BrowserStorage');
Shared.pageType = 'background';
Shared.storage = BrowserStorage;
Shared.errors = {validate: () => true, log() {}} as unknown as typeof Shared.errors;
// Keep real local event listeners, without broadcasting test events to tabs.
EventDispatcher.GLOBAL_EVENTS = [];
const tab = (id: number, status: 'complete' | 'loading' = 'complete', url = 'https://www.netflix.com/watch/123') => ({id, status, url}) as Tabs.Tab;

beforeEach(async () => {
  for (const key of Object.keys(session)) delete session[key];
  injected.length = 0;
  failInjection = false;
  Shared.waitForInit = async () => {};
  BrowserStorage.options = {services: {'netflix': {scrobble: true}, 'amazon-prime': {}, 'hbo-max': {}}} as any;
  BrowserStorage.get = async () => ({});
  EventDispatcher.listeners = {};
  ScriptInjector.init();
});

test('tracking registers its wakeup listener before initialization', () => {
  ScriptInjector.addBackgroundListeners();
  assert.equal(updateListener, ScriptInjector.onTabUpdated);
});

test('updates buffered during startup inject once after initialization', async () => {
  let ready!: () => void;
  Shared.waitForInit = () => new Promise<void>(resolve => {ready = resolve;});
  const first = ScriptInjector.onTabUpdated(10, {status: 'complete'}, tab(10));
  const second = ScriptInjector.onTabUpdated(10, {status: 'complete'}, tab(10));
  await Promise.resolve();
  assert.deepEqual(injected, []);
  Shared.waitForInit = async () => {};
  ready();
  await Promise.all([first, second]);
  assert.deepEqual(injected, [10]);
});

test('reload cleanup finishes before the next injection', async () => {
  await ScriptInjector.onTabUpdated(10, {status: 'complete'}, tab(10));
  await Promise.all([
    ScriptInjector.onTabUpdated(10, {status: 'loading'}, tab(10, 'loading')),
    ScriptInjector.onTabUpdated(10, {status: 'complete'}, tab(10)),
  ]);
  assert.deepEqual(injected, [10, 10]);
});

test('simultaneous tabs remain recorded and are not reinjected', async () => {
  await Promise.all([10, 11].map(id => ScriptInjector.onTabUpdated(id, {status: 'complete'}, tab(id))));
  assert.deepEqual([...session.injectedContentScriptTabs].sort(), [10, 11]);
  await Promise.all([10, 11].map(id => ScriptInjector.onTabUpdated(id, {status: 'complete'}, tab(id))));
  assert.deepEqual(injected.sort(), [10, 11]);
  await Promise.all([SessionStorage.updateInjectedTab(10, false), SessionStorage.updateInjectedTab(12, true)]);
  assert.deepEqual([...session.injectedContentScriptTabs].sort(), [11, 12]);
});

test('a failed injection releases the tab for retry', async () => {
  failInjection = true;
  await ScriptInjector.onTabUpdated(10, {status: 'complete'}, tab(10));
  assert.deepEqual(session.injectedContentScriptTabs, []);
  failInjection = false;
  await ScriptInjector.onTabUpdated(10, {status: 'complete'}, tab(10));
  assert.deepEqual(injected, [10]);
});

test('disabled tracking and lookalike domains do not inject', async () => {
  await ScriptInjector.onTabUpdated(10, {status: 'complete'}, tab(10, 'complete', 'https://www.netflix.com.evil.test/watch/123'));
  await ScriptInjector.onTabUpdated(12, {status: 'complete'}, tab(12, 'complete', 'https://www.netflixXcom/watch/123'));
  BrowserStorage.options.services.netflix.scrobble = false;
  ScriptInjector.updateContentScripts();
  await ScriptInjector.onTabUpdated(11, {status: 'complete'}, tab(11));
  assert.deepEqual(injected, []);
});

test('a full navigation with a new URL stops the old document and reinjects', async () => {
  await ScriptInjector.onTabUpdated(10, {status: 'complete'}, tab(10));
  const url = 'https://www.netflix.com/watch/456';
  await ScriptInjector.onTabUpdated(10, {status: 'loading', url}, tab(10, 'loading', url));
  await ScriptInjector.onTabUpdated(10, {status: 'complete'}, tab(10, 'complete', url));
  assert.deepEqual(injected, [10, 10]);
});

test('navigating away clears the old tab even though the new host is unsupported', async () => {
  await ScriptInjector.onTabUpdated(10, {status: 'complete'}, tab(10));
  const url = 'https://example.org/';
  await ScriptInjector.onTabUpdated(10, {status: 'loading', url}, tab(10, 'loading', url));
  await ScriptInjector.onTabUpdated(10, {status: 'complete'}, tab(10, 'complete', url));
  assert.deepEqual(session.injectedContentScriptTabs, []);
  assert.deepEqual(injected, [10]);
});
