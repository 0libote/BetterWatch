import browser, { Storage as WebExtStorage } from 'webextension-polyfill';
import { Shared } from '@common/Shared';

export interface SessionStorageValues {
	injectedContentScriptTabs?: number[];
}

class _SessionStorage {
	private tabWrites: Promise<void> = Promise.resolve();

	updateInjectedTab(tabId: number, injected: boolean): Promise<void> {
		// Serialize read/modify/write operations so different tabs cannot overwrite one another.
		const write = this.tabWrites.then(async () => {
			const values = await this.get('injectedContentScriptTabs');
			const tabs = new Set(values.injectedContentScriptTabs ?? []);
			if (injected) tabs.add(tabId);
			else tabs.delete(tabId);
			await this.set({ injectedContentScriptTabs: Array.from(tabs) });
		});
		this.tabWrites = write.catch(() => {});
		return write;
	}

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
