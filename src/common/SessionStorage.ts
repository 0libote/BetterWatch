import browser, { Storage as WebExtStorage } from 'webextension-polyfill';
import { Shared } from '@common/Shared';

export interface SessionStorageValues {
	injectedContentScriptTabs?: number[];
}

class _SessionStorage {
	instance: WebExtStorage.StorageArea =
		Shared.manifestVersion === 3
			? browser.storage.session
			: browser.storage.local;

	async set(values: SessionStorageValues): Promise<void> {
		return this.instance.set({ ...values });
	}

	async get(
		keys?: keyof SessionStorageValues | (keyof SessionStorageValues)[] | null
	): Promise<SessionStorageValues> {
		return this.instance.get(keys);
	}
}

export const SessionStorage = new _SessionStorage();
