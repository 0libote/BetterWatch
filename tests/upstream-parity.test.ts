import { test } from 'bun:test';
import assert from 'node:assert/strict';

Object.assign(globalThis, {
	chrome: { runtime: { id: 'test' } },
	browser: { runtime: {
		id: 'test', getURL: () => 'chrome-extension://test/', getManifest: () => ({ manifest_version: 3 }),
	}, storage: { session: {} } },
});
require('../src/services/services');
const { serviceForHost } = require('../src/skip/model') as typeof import('../src/skip/model');
const { createManifest } = require('../scripts/manifest') as typeof import('../scripts/manifest');
const { NetflixApi } = require('../src/services/netflix/NetflixApi') as typeof import('../src/services/netflix/NetflixApi');
const { AmazonPrimeApi } = require('../src/services/amazon-prime/AmazonPrimeApi') as typeof import('../src/services/amazon-prime/AmazonPrimeApi');

test('Netflix regional hosts match upstream coverage', () => {
	assert.equal(serviceForHost('www.netflix.com'), 'netflix');
	assert.equal(serviceForHost('www.netflix.ca'), 'netflix');
	assert.equal(serviceForHost('www.netflix.com.au'), 'netflix');
	assert.equal(serviceForHost('netflix.ca.attacker.example'), null);
	const manifest = createManifest('0.0.0');
	assert.ok(manifest.host_permissions.includes('*://*.netflix.ca/*'));
	assert.ok(manifest.host_permissions.includes('*://*.netflix.com.au/*'));
});

test('Prime Filipino intro label is recognized without clicking bonus titles', () => {
	const { classifyAction, RULES } = require('../src/skip/model') as typeof import('../src/skip/model');
	const rule = RULES['amazon-prime'][0];
	const intro = { textContent: 'Laktawan ang intro', getAttribute: () => null, matches: () => false } as unknown as Element;
	assert.equal(classifyAction(rule, intro), 'intro');
	const bonus = { textContent: 'Introduction', getAttribute: () => null, matches: () => false } as unknown as Element;
	assert.equal(classifyAction(rule, bonus), null);
});

test('Netflix artwork picks the smallest image covering the history card', () => {
	const show = NetflixApi.parseMetadata({
		video: {
			type: 'show', id: 1, title: 'Show', year: 2020, currentEpisode: 11,
			hiddenEpisodeNumbers: false, artwork: [],
			seasons: [{ seq: 1, episodes: [{ id: 11, seq: 2, title: 'Ep', stills: [
				{ url: 'small', w: 100, h: 50 }, { url: 'medium', w: 400, h: 200 }, { url: 'large', w: 800, h: 400 },
			], thumbs: [] }] }],
		},
	});
	assert.equal(show.imageUrl, 'medium');
	const movie = NetflixApi.parseMetadata({
		video: { type: 'movie', id: 2, title: 'Movie', year: 2021, artwork: [{ url: 'only', w: 100, h: 50 }] },
	});
	assert.equal(movie.imageUrl, 'only');
});

test('Netflix history items retain upstream artwork', () => {
	const item = NetflixApi.parseHistoryItem({
		movieID: 11, date: 1700000000, bookmark: 100, duration: 100,
		series: 1, seriesTitle: 'Show', episodeTitle: 'Ep', title: 'Ep',
		releaseYear: 2020,
		summary: { season: 1, episode: 2, id: 11 },
		season: { summary: { hiddenEpisodeNumbers: false } },
		imageUrl: 'https://artwork.example/ep.jpg',
	});
	assert.equal(item.imageUrl, 'https://artwork.example/ep.jpg');
	const film = NetflixApi.parseHistoryItem({
		movieID: 2, date: 1700000000, bookmark: 100, duration: 100,
		title: 'Movie', releaseYear: 2021,
		summary: { id: 2 },
		imageUrl: 'https://artwork.example/movie.jpg',
	});
	assert.equal(film.imageUrl, 'https://artwork.example/movie.jpg');
});

test('Prime metadata carries the upstream title artwork', () => {
	const episode = AmazonPrimeApi.parseMetadata({
		catalogMetadata: {
			catalog: { entityType: 'TV Show', episodeNumber: 2, id: 'e1', title: 'Ep' },
			family: { tvAncestors: [{ catalog: { seasonNumber: 1 } }, { catalog: { title: 'Show' } }] },
			images: { imageUrls: { episode: 'ep.jpg', title: 'title.jpg', hero: 'hero.jpg' } },
		},
	});
	assert.equal(episode.imageUrl, 'title.jpg');
	const movie = AmazonPrimeApi.parseMetadata({
		catalogMetadata: {
			catalog: { entityType: 'Movie', id: 'm1', title: 'Film' },
			images: { imageUrls: { episode: 'ep.jpg', title: 'film.jpg', hero: 'hero.jpg' } },
		},
	});
	assert.equal(movie.imageUrl, 'film.jpg');
});
