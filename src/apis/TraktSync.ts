import { TraktApi } from '@apis/TraktApi';
import { TraktAuth } from '@apis/TraktAuth';
import { Cache, CacheItem } from '@common/Cache';
import { Shared } from '@common/Shared';
import { Utils } from '@common/Utils';
import { ScrobbleItem } from '@models/Item';
import { SyncStore } from '@stores/SyncStore';

export interface TraktHistoryItem {
	id: number;
	watched_at: string;
}

export interface ParsedTraktHistoryItem {
	id: number;
	watched_at: number;
}

export interface TraktSyncResponse {
	added: {
		episodes: number;
		movies: number;
	};
	not_found: {
		episodes: TraktSyncNotFound[];
		movies: TraktSyncNotFound[];
	};
}

export interface TraktSyncNotFound {
	ids: {
		trakt: number;
	};
}

class _TraktSync extends TraktApi {
	constructor() {
		super();
	}

	override async activate(): Promise<void> {
		if (!(await TraktAuth.validateToken())) throw new Error('Connect Trakt before using your watch history.');
		await super.activate();
	}

	async loadHistory(
		item: ScrobbleItem,
		traktHistoryItemsCache: CacheItem<'traktHistoryItems'>,
		forceRefresh = false,
		cancelKey = 'default'
	): Promise<void> {
		const watchedAt = item.trakt?.watchedAt || item.getWatchedDate();
		if (!item.trakt || !watchedAt) {
			return;
		}
		const databaseId = item.trakt.getDatabaseId();
		let historyItems = forceRefresh ? null : traktHistoryItemsCache.get(databaseId);
		if (!historyItems) {
			await this.activate();
			const responseText = await this.requests.send({
				url: this.getUrl(item),
				method: 'GET',
				cancelKey,
			});
			historyItems = JSON.parse(responseText) as TraktHistoryItem[];
			traktHistoryItemsCache.set(databaseId, historyItems);
		}
		let historyItemMatch: ParsedTraktHistoryItem | null = null;
		const historyItemOtherWatches: number[] = [];
		for (const historyItem of historyItems) {
			const parsedHistoryItem: ParsedTraktHistoryItem = {
				id: historyItem.id,
				watched_at: Utils.unix(historyItem.watched_at),
			};
			if (watchedAt === parsedHistoryItem.watched_at) {
				historyItemMatch = parsedHistoryItem;
				break;
			} else if (Utils.dateDiff(watchedAt, parsedHistoryItem.watched_at, 26 * 60 * 60)) {
				historyItemMatch = parsedHistoryItem;
			} else {
				historyItemOtherWatches.push(parsedHistoryItem.watched_at);
			}
		}
		if (historyItemMatch) {
			item.trakt.syncId = historyItemMatch.id;
			item.trakt.watchedAt = historyItemMatch.watched_at;
		} else {
			item.trakt.watchedAt = null;
		}

		item.trakt.otherWatches = historyItemOtherWatches;
	}

	async removeHistory(item: ScrobbleItem): Promise<void> {
		if (!item.trakt?.syncId) {
			return;
		}
		await this.activate();
		await this.requests.send({
			url: `${this.SYNC_URL}/remove`,
			method: 'POST',
			body: {
				ids: [item.trakt.syncId],
			},
		});
		item.trakt.syncId = undefined;
		item.trakt.watchedAt = undefined;
	}

	getUrl(item: ScrobbleItem): string {
		if (!item.trakt) {
			return '';
		}
		let url = '';
		if (item.trakt.type === 'episode') {
			url = `${this.SYNC_URL}/episodes/${item.trakt.id}`;
		} else {
			url = `${this.SYNC_URL}/movies/${item.trakt.id}`;
		}
		return url;
	}

	async sync(store: SyncStore, items: ScrobbleItem[], cancelKey = 'sync') {
		const newItems: ScrobbleItem[] = [];
		try {
			await this.activate();
			const traktHistoryItemsCache = await Cache.get('traktHistoryItems');
			const pending: ScrobbleItem[] = [];
			// A failed response may follow an accepted write. Recheck selected watches before retrying.
			for (const selected of items) {
				const item = selected.clone();
				if (!item.trakt || !item.getWatchedDate()) throw new Error('Match and date are required for history import.');
				await this.loadHistory(item, traktHistoryItemsCache, true, cancelKey);
				if (item.trakt.watchedAt) {
					item.isSelected = false;
					newItems.push(item);
				} else {
					pending.push(item);
				}
			}
			if (!pending.length) {
				await Cache.set({ traktHistoryItems: traktHistoryItemsCache });
				await store.update(newItems, true);
				await Shared.events.dispatch('HISTORY_SYNC_SUCCESS', null, { added: { episodes: 0, movies: 0 } });
				return;
			}
			const data = {
				episodes: pending
					.filter((item) => item.type === 'episode')
					.map((item) => ({
						ids: { trakt: item.trakt?.id },
						watched_at: Utils.convertToISOString(item.getWatchedDate()),
					})),
				movies: pending
					.filter((item) => item.type === 'movie')
					.map((item) => ({
						ids: { trakt: item.trakt?.id },
						watched_at: Utils.convertToISOString(item.getWatchedDate()),
					})),
			};
			const responseText = await this.requests.send({
				url: this.SYNC_URL,
				method: 'POST',
				body: data,
				cancelKey,
			});
			const responseJson = JSON.parse(responseText) as TraktSyncResponse;
			const notFoundItems = {
				episodes: responseJson.not_found.episodes.map((item) => item.ids.trakt),
				movies: responseJson.not_found.movies.map((item) => item.ids.trakt),
			};
			for (const item of pending) {
				if (
					item.trakt &&
					((item.type === 'episode' && !notFoundItems.episodes.includes(item.trakt.id)) ||
						(item.type === 'movie' && !notFoundItems.movies.includes(item.trakt.id)))
				) {
					const newItem = item.clone();
					await TraktSync.loadHistory(newItem, traktHistoryItemsCache, true, cancelKey);
					newItem.isSelected = false;
					newItems.push(newItem);
				}
			}
			await Cache.set({ traktHistoryItems: traktHistoryItemsCache });
			await store.update(newItems, true);
			if (notFoundItems.episodes.length || notFoundItems.movies.length) {
				throw new Error('Trakt could not find all selected titles. Review the remaining matches.');
			}
			await Shared.events.dispatch('HISTORY_SYNC_SUCCESS', null, {
				added: responseJson.added,
			});
		} catch (err) {
			if (Shared.errors.validate(err)) {
				Shared.errors.error('Failed to sync history.', err);
				// Keep the failed watches selected so they can be reviewed and retried
				// instead of being silently dropped from the selection.
				for (const newItem of newItems) {
					newItem.isSelected = !newItem.trakt?.watchedAt;
				}
				await store.update(newItems, true);
				await Shared.events.dispatch('HISTORY_SYNC_ERROR', null, { error: err });
			}
			throw err;
		}
	}
}

export const TraktSync = new _TraktSync();
