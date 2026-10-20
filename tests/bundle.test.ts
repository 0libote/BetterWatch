import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import path from 'node:path';

for (const minify of [false, true]) {
  test(`${minify ? 'production' : 'development'} bundle registers all services and keeps injected Netflix functions self-contained`, async () => {
    const entry = path.resolve('tests/bundled-services.ts');
    const result = await Bun.build({
      entrypoints: [entry],
      files: {
        [entry]: `
          import '@services';
          import '@services-apis';
          import { Shared } from '@common/Shared';
          import { getServices } from '@models/Service';
          globalThis.result = { ids: getServices().map(service => service.id), functions: Shared.functionsToInject };
        `,
      },
      target: 'browser',
      format: 'iife',
      minify,
      env: 'disable',
      define: { 'process.env': '{}' },
    });
    assert.ok(result.success, result.logs.map(String).join('\n'));
    const bundle = await result.outputs[0].text();
    const compiled = runInNewContext(`
      globalThis.chrome = { runtime: { id: 'test' } };
      globalThis.browser = { storage: { session: {} }, runtime: {
        getURL: () => 'chrome-extension://test/',
        getManifest: () => ({ manifest_version: 3 })
      } };
      ${bundle}
      result;
    `);
    assert.deepEqual(Array.from(compiled.ids).sort(), [
      'amazon-prime',
      'hbo-max',
      'netflix',
    ]);
    const session = {
      playing: true,
      paused: false,
      currentTime: 120,
      duration: 1200,
      videoId: 123,
    };
    const window = {
      netflix: {
        reactContext: {
          models: {
            userInfo: {
              data: {
                authURL: 'test-auth',
                name: 'Test profile',
                userGuid: 'profile-1',
              },
            },
            serverDefs: { data: { BUILD_IDENTIFIER: 'test-build' } },
          },
        },
        appContext: {
          state: {
            playerApp: {
              getState: () => ({
                videoPlayer: { playbackStateBySessionId: { current: session } },
              }),
            },
          },
        },
      },
    };
    // Chrome serializes these functions into the page without the bundle's scope.
    const inject = (key: string) =>
      runInNewContext(`(${compiled.functions[key].toString()})()`, { window });
    const account = inject('netflix-session');
    assert.equal(account.authUrl, 'test-auth');
    assert.equal(account.profileName, 'Test profile');
    assert.equal(account.buildIdentifier, 'test-build');
    const playback = inject('netflix-playback');
    assert.equal(playback.videoId, '123');
    assert.equal(playback.progress, 10);
    assert.equal(playback.isPaused, false);
    session.duration = 0;
    assert.equal(inject('netflix-playback'), null);
  });
}
