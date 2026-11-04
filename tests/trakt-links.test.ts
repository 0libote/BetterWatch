import { describe, test } from 'bun:test';
import assert from 'node:assert/strict';

const local: Record<string, any> = {};
const synced: Record<string, any> = {};
const area = (data: Record<string, any>) => ({
	async get(keys?: string | string[]) {
		return keys
			? Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, data[key]]))
			: { ...data };
	},
	async set(values: Record<string, any>) {
		Object.assign(data, values);
	},
	async remove(keys: string | string[]) {
		for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
	},
});
const fakeBrowser = {
	runtime: { id: 'test', getURL: () => 'chrome-extension://test/', getManifest: () => ({ manifest_version: 3 }) },
	identity: { getRedirectURL: () => 'https://test.chromiumapp.org/', launchWebAuthFlow: async () => '' },
	storage: { local: area(local), sync: area(synced), session: area({}) },
	tabs: { remove: async () => {} },
};
Object.assign(globalThis, {
	chrome: { runtime: { id: 'test' } },
	browser: fakeBrowser,
	window: { location: { href: 'https://app.trakt.tv/' } },
});

const { TraktEpisodeItem, TraktShowItem, TraktMovieItem } = require('../src/models/TraktItem') as typeof import(
	'../src/models/TraktItem'
);
const { CorrectionApi } = require('../src/apis/CorrectionApi') as typeof import('../src/apis/CorrectionApi');
const { Shared } = require('../src/common/Shared') as typeof import('../src/common/Shared');
const { BrowserStorage } = require('../src/common/BrowserStorage') as typeof import('../src/common/BrowserStorage');
Shared.pageType = 'background';
Shared.storage = BrowserStorage;
const { TraktSearch } = require('../src/apis/TraktSearch') as typeof import('../src/apis/TraktSearch');

const episode = new TraktEpisodeItem({
	id: 11,
	tmdbId: 22,
	title: 'Pilot',
	year: 2020,
	season: 1,
	number: 2,
	show: { id: 33, tmdbId: 44, title: 'Dark', year: 2017 },
});

const show = new TraktShowItem({ id: 33, tmdbId: 44, title: 'Dark', year: 2017 });
const movie = new TraktMovieItem({ id: 55, tmdbId: 66, title: 'Dune', year: 2021 });

describe('trakt app links', () => {
	test('episode link points at the app with show id and season/episode', () => {
		const url = new URL(episode.getUrl());
		assert.equal(url.hostname, 'app.trakt.tv');
		assert.equal(url.pathname, '/shows/33');
		assert.equal(url.searchParams.get('view'), 'episode');
		assert.equal(url.searchParams.get('season'), '1');
		assert.equal(url.searchParams.get('episode'), '2');
	});

	test('show and movie links point at the app', () => {
		assert.equal(show.getUrl(), 'https://app.trakt.tv/shows/33');
		assert.equal(movie.getUrl(), 'https://app.trakt.tv/movies/55');
	});

	test('suggestion cache id matches the stored trakt item id', () => {
		assert.equal(CorrectionApi.getSuggestionDatabaseId({ type: 'episode', id: 11 }), episode.getDatabaseId());
		assert.equal(CorrectionApi.getSuggestionDatabaseId({ type: 'movie', id: 55 }), movie.getDatabaseId());
	});

	test('findById serves cached suggestions without network', async () => {
		const store = new Map<string, any>([[episode.getDatabaseId(), episode.save()]]);
		const caches = { traktItems: { get: (key: string) => store.get(key) } };
		const found = await TraktSearch.findById({ type: 'episode', id: 11 }, caches as never);
		assert.equal(found.getDatabaseId(), episode.getDatabaseId());
		assert.equal(found.getUrl(), episode.getUrl());
	});
});

const {cleanTraktUrl} = require('../src/common/TraktUrl') as typeof import('../src/common/TraktUrl');
test('corrections accept current and legacy movie/episode URLs including specials', () => {
  assert.equal(cleanTraktUrl(episode.getUrl()), '/shows/33/seasons/1/episodes/2');
  assert.equal(cleanTraktUrl('https://trakt.tv/shows/dark/seasons/0/episodes/1'), '/shows/dark/seasons/0/episodes/1');
  assert.equal(cleanTraktUrl('app.trakt.tv/movies/dune-2021'), '/movies/dune-2021');
  assert.equal(cleanTraktUrl('https://www.trakt.tv/movies/55/?foo=bar'), '/movies/55');
});
test('corrections reject lookalike hosts, incomplete episodes and injected API paths', () => {
  for (const value of ['https://app.trakt.tv.evil.test/movies/55', 'https://evil.test/movies/55',
    'https://app.trakt.tv/shows/33', 'https://app.trakt.tv/shows/33?season=1&episode=0',
    'https://app.trakt.tv/shows/33?season=../users&episode=1', 'https://app.trakt.tv/movies/55/other', 'invalid']) {
    assert.equal(cleanTraktUrl(value), '', value);
  }
});

test('uncached episode suggestions resolve their show and cache the reusable title', async () => {
  const {CacheItem} = require('../src/common/Cache') as typeof import('../src/common/Cache');
  const caches = {traktItems: new CacheItem<'traktItems'>({}), urlsToTraktItems: new CacheItem<'urlsToTraktItems'>({})};
  const original = TraktSearch.findExactItem;
  let calls = 0;
  TraktSearch.findExactItem = async () => {
    calls++;
    return {episode: {title:'Pilot',season:1,number:2,ids:{trakt:11,tmdb:22},first_aired:'2020-01-01T00:00:00.000Z'},
      show: {title:'Dark',year:2017,ids:{trakt:33,tmdb:44}}};
  };
  try {
    const found = await TraktSearch.findById({type:'episode',id:11}, caches);
    assert.equal(found.getUrl(), episode.getUrl());
    assert.equal(caches.traktItems.get('episode_11')?.watchedAt, undefined);
    assert.equal((await TraktSearch.findById({type:'episode',id:11}, caches)).getUrl(), episode.getUrl());
    assert.equal(calls, 1);
  } finally {TraktSearch.findExactItem = original;}
});
