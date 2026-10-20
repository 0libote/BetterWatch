import { test } from 'node:test';
import assert from 'node:assert/strict';

const local: Record<string, any> = {};
const synced: Record<string, any> = {};
const area = (data: Record<string,any>) => ({
  async get(keys?: string | string[]) {return keys ? Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key,data[key]])) : {...data};},
  async set(values: Record<string,any>) {Object.assign(data,values);},
  async remove(keys: string | string[]) {for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];},
});
const fakeBrowser = {
  runtime: {id:'test', getURL: () => 'chrome-extension://test/', getManifest: () => ({manifest_version:3})},
  identity: {getRedirectURL: () => 'https://test.chromiumapp.org/', launchWebAuthFlow: async (_options: any) => ''},
  storage: {local: area(local),sync: area(synced),session: area({})},
  tabs: {remove: async (_id: number) => {}},
};
Object.assign(globalThis,{chrome: {runtime: {id:'test'}},browser:fakeBrowser});
const {Shared} = require('../src/common/Shared') as typeof import('../src/common/Shared');
const {TraktAuth} = require('../src/apis/TraktAuth') as typeof import('../src/apis/TraktAuth');
const {TraktApi} = require('../src/apis/TraktApi') as typeof import('../src/apis/TraktApi');
const {BrowserStorage} = require('../src/common/BrowserStorage') as typeof import('../src/common/BrowserStorage');
Shared.pageType = 'background';
local.traktApp = {clientId:'local-client',clientSecret:'local-secret'};
Shared.storage = BrowserStorage;

const auth = {access_token:'new-token',refresh_token:'refresh',created_at:Math.floor(Date.now()/1000),expires_in:1000,token_type:'bearer',scope:'public'};

test('OAuth refuses a callback with a different state before exchanging a code', async () => {
  let exchanged = false;
  const original = TraktAuth.getToken;
  TraktAuth.getToken = async () => {exchanged = true;return auth;};
  fakeBrowser.identity.launchWebAuthFlow = async () => 'https://test.chromiumapp.org/?code=wrong&state=wrong';
  try {await assert.rejects(TraktAuth.startIdentityAuth(),/state mismatch/);assert.equal(exchanged,false);}
  finally {TraktAuth.getToken = original;}
});
test('OAuth accepts only the state from this exact authorization attempt', async () => {
  const original = TraktAuth.getToken;
  TraktAuth.getToken = async () => auth;
  fakeBrowser.identity.launchWebAuthFlow = async ({url}) => {
    const state = new URL(url).searchParams.get('state');
    return `https://test.chromiumapp.org/?code=ok&state=${state}`;
  };
  try {assert.equal((await TraktAuth.startIdentityAuth()).access_token,'new-token');}
  finally {TraktAuth.getToken = original;}
});
test('Trakt API uses locally configured app credentials and the current token', async () => {
  local.auth = {...auth,access_token:'first-token'};
  const api = new TraktApi();await api.activate();
  assert.equal(api.requests.withHeaders['trakt-api-key'],'local-client');
  assert.equal(api.requests.withHeaders.Authorization,'Bearer first-token');
  local.auth = auth;await api.activate();
  assert.equal(api.requests.withHeaders.Authorization,'Bearer new-token');
});
test('concurrent expired-token checks share one refresh operation', async () => {
  local.auth = {...auth,created_at:1,expires_in:1};
  let calls = 0;
  const original = TraktAuth.refreshToken;
  TraktAuth.refreshToken = async () => {calls++;await new Promise(resolve => setTimeout(resolve,10));return auth;};
  try {
    const results = await Promise.all([TraktAuth.validateToken(),TraktAuth.validateToken()]);
    assert.equal(calls,1);assert.equal(results[0]?.access_token,'new-token');
  } finally {TraktAuth.refreshToken = original;}
});
test('saving authentication keeps tokens out of Chrome Sync', async () => {
  await BrowserStorage.set({auth},true);
  assert.equal(local.auth.access_token,'new-token');assert.equal(synced.auth,undefined);
});
test('syncing settings cannot replace local app authentication', async () => {
  synced.auth = {...auth,access_token:'other-profile'};local.auth = auth;
  await BrowserStorage.sync();assert.equal(local.auth.access_token,'new-token');delete synced.auth;
});
test('removing a single synced key removes the complete key', async () => {
  synced.auth = auth;local.auth = auth;
  await BrowserStorage.remove('auth',true);
  assert.equal(local.auth,undefined);assert.equal(synced.auth,undefined);
});
test('canceling Chrome sign-in fails promptly and the next attempt still works', async () => {
  const original = TraktAuth.getToken;
  TraktAuth.getToken = async () => auth;
  fakeBrowser.identity.launchWebAuthFlow = async () => {throw new Error('canceled');};
  try {
    await assert.rejects(TraktAuth.startIdentityAuth(),/canceled/);
    assert.equal(TraktAuth.isIdentityAvailable,true);
    fakeBrowser.identity.launchWebAuthFlow = async ({url}) => `https://test.chromiumapp.org/?code=ok&state=${new URL(url).searchParams.get('state')}`;
    assert.equal((await TraktAuth.startIdentityAuth()).access_token,'new-token');
  } finally {TraktAuth.getToken = original;}
});
test('a temporary token-endpoint failure preserves refresh credentials', async () => {
  const {Requests} = require('../src/common/Requests') as typeof import('../src/common/Requests');
  const {RequestError} = require('../src/common/RequestError') as typeof import('../src/common/RequestError');
  const original = Requests.send;
  local.auth = auth;
  Requests.send = async () => {throw new RequestError({status:503,text:'temporarily unavailable'});};
  try {
    await assert.rejects(TraktAuth.requestToken({grant_type:'refresh_token'}));
    assert.equal(local.auth.refresh_token,'refresh');
  } finally {Requests.send = original;}
});
test('rejected refresh credentials clear authentication so the user can reconnect', async () => {
  const {Requests} = require('../src/common/Requests') as typeof import('../src/common/Requests');
  const {RequestError} = require('../src/common/RequestError') as typeof import('../src/common/RequestError');
  const original = Requests.send;
  local.auth = auth;
  Requests.send = async () => {throw new RequestError({status:401,text:'invalid token'});};
  try {
    await assert.rejects(TraktAuth.requestToken({grant_type:'refresh_token'}));
    assert.equal(local.auth,undefined);
  } finally {Requests.send = original;}
});
test('playback detection waits for Trakt login and resumes in an already open tab', async () => {
  const {ScrobbleEvents} = require('../src/common/ScrobbleEvents') as typeof import('../src/common/ScrobbleEvents');
  class TestEvents extends ScrobbleEvents {async tick() {await this.checkForChanges();}}
  let parsed = 0;
  const controller = {
    api:{id:'netflix'},
    parser:{options:{},async parsePlayback(){parsed++;return null;}},
  } as unknown as import('../src/common/ScrobbleController').ScrobbleController;
  Object.assign(globalThis,{window:{location:{href:'https://www.netflix.com/watch/123'},setTimeout:()=>1}});
  const events = new TestEvents(controller);
  delete local.auth;await events.tick();assert.equal(parsed,0);
  local.auth = auth;await events.tick();assert.equal(parsed,1);
});
