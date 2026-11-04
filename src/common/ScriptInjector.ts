import { TraktScrobble } from '@apis/TraktScrobble';
import { ContentScriptConnectData, StorageOptionsChangeData } from '@common/Events';
import { Messaging } from '@common/Messaging';
import { SessionStorage } from '@common/SessionStorage';
import { Shared } from '@common/Shared';
import { Tabs } from '@common/Tabs';
import { getServices, Service } from '@models/Service';
import browser, { Tabs as WebExtTabs } from 'webextension-polyfill';

export interface ScriptInjectorMessage {
	serviceId: string;
	key: string;
	url: string;
	fnStr: string;
}

class _ScriptInjector {
	contentScripts: Service[] | null = null;
	injectedScriptIds = new Set<string>();
	private tabUpdates = new Map<number, Promise<void>>();

	// Register before async initialization so tab updates can wake the service worker.
	addBackgroundListeners() {
		if (Shared.browser === 'firefox') {
			// Firefox can filter by URL, which avoids waking up the background for unrelated tabs.
			browser.tabs.onUpdated.addListener(this.onTabUpdated, {
				urls: getServices().flatMap((service) => service.hostPatterns),
			});
		} else {
			browser.tabs.onUpdated.addListener(this.onTabUpdated);
		}
	}

	init() {
		if (Shared.pageType === 'background') {
			this.updateContentScripts();
			Shared.events.subscribe('STORAGE_OPTIONS_CHANGE', null, this.onStorageOptionsChange);
			Shared.events.subscribe('CONTENT_SCRIPT_DISCONNECT', null, this.onContentScriptDisconnect);
		}
	}

	private onStorageOptionsChange = (data: StorageOptionsChangeData) => {
		if (data.options?.services) {
			const doCheck = Object.values(data.options.services).some(
				(serviceValue) => serviceValue && ('scrobble' in serviceValue || 'sync' in serviceValue)
			);
			if (doCheck) {
				this.updateContentScripts();
			}
		}
	};

	private onContentScriptDisconnect = async (data: ContentScriptConnectData) => {
		await SessionStorage.updateInjectedTab(data.tabId, false);
		const { scrobblingDetails } = await Shared.storage.get('scrobblingDetails');
		if (scrobblingDetails && data.tabId === scrobblingDetails.tabId) {
			await TraktScrobble.stop();
		}
	};

	updateContentScripts() {
		this.contentScripts = getServices()
			.filter(
				(service) =>
					(service.hasScrobbler && Shared.storage.options.services[service.id].scrobble) ||
					(service.hasSync && Shared.storage.options.services[service.id].sync)
			);
	}

	onTabUpdated = (
		tabId: number,
		changeInfo: WebExtTabs.OnUpdatedChangeInfoType,
		tab: WebExtTabs.Tab
	) => {
		if (!tab.url || (changeInfo.status !== 'loading' &&
			!getServices().some(service => service.matchesUrl(tab.url!)))) return Promise.resolve();
		// Keep startup bursts and reload cleanup in order for each tab.
		const previousUpdate = this.tabUpdates.get(tabId) ?? Promise.resolve();
		const update = previousUpdate
			.then(() => this.onTabUpdatedAfterInit(changeInfo, tab))
			.catch((err) => {
				if (Shared.errors.validate(err)) {
					Shared.errors.log('Failed to inject content script.', err);
				}
			})
			.finally(() => {
				if (this.tabUpdates.get(tabId) === update) {
					this.tabUpdates.delete(tabId);
				}
			});
		this.tabUpdates.set(tabId, update);
		return update;
	};

	private async onTabUpdatedAfterInit(
		changeInfo: WebExtTabs.OnUpdatedChangeInfoType,
		tab: WebExtTabs.Tab
	) {
		// When the update wakes up the background, the listener fires before the options are loaded.
		await Shared.waitForInit();
		await this.injectContentScript(changeInfo, tab);
	}

	async injectContentScript(
		changeInfo: WebExtTabs.OnUpdatedChangeInfoType,
		tab: Partial<WebExtTabs.Tab>
	) {
		const values = await SessionStorage.get('injectedContentScriptTabs');
		const injectedContentScriptTabs = new Set(values.injectedContentScriptTabs ?? []);
		if (
			tab.id &&
			injectedContentScriptTabs.has(tab.id) &&
			changeInfo.status === 'loading'
		) {
			await Shared.events.dispatch('CONTENT_SCRIPT_DISCONNECT', null, { tabId: tab.id });
			return;
		}
		if (
			!this.contentScripts ||
			tab.status !== 'complete' ||
			!tab.id ||
			!tab.url ||
			!tab.url.startsWith('http') ||
			injectedContentScriptTabs.has(tab.id)
		) {
			return;
		}
		for (const service of this.contentScripts) {
			if (!service.matchesUrl(tab.url)) continue;
			await SessionStorage.updateInjectedTab(tab.id, true);
			const file = `${service.id}.js`;
			try {
				if (Shared.manifestVersion === 3) {
					await browser.scripting.executeScript({ target: { tabId: tab.id }, files: [file] });
				} else {
					await browser.tabs.executeScript(tab.id, { file });
				}
			} catch (err) {
				await SessionStorage.updateInjectedTab(tab.id, false);
				throw err;
			}
			break;
		}
	}

	/**
	 * The function that will be injected must be added to the `{serviceId}-{key}` key in `Shared.functionsToInject` e.g. `netflix-session`. It should not contain any references to outside variables/functions, because they will not be available in the injected script.
	 *
	 * Keep injected functions self-contained after bundling too: Chrome serializes the function without its module scope, so references to compiler helpers or imported values will not be available. Inspect the bundled function when changing its syntax.
	 *
	 * @param serviceId
	 * @param key This should be unique for `serviceId`.
	 * @param url If the content page isn't open, this URL will be used to open a tab in the background, so that the script can be injected. If an empty string is provided, `null` will be returned instead.	 *
	 * @param params If outside values are needed, they should be added to this object. It will be passed as the first argument to the function.
	 * @returns
	 */
	inject<T>(
		serviceId: string,
		key: string,
		url: string,
		params: Record<string, unknown> = {}
	): Promise<T | null> {
		if (Shared.pageType !== 'content') {
			return this.injectInTab(serviceId, key, url, params);
		}

		if (Shared.manifestVersion === 3) {
			return Messaging.toExtension({
				action: 'inject-function-from-background',
				serviceId,
				key,
				url,
				params,
				tabId: Shared.tabId,
			}) as Promise<T | null>;
		}

		return new Promise((resolve) => {
			try {
				const id = `${serviceId}-${key}`;

				if (!this.injectedScriptIds.has(id)) {
					const scriptFn = this.getScriptFn();
					const idStr = JSON.stringify(id);
					const fnStr = Shared.functionsToInject[id].toString();
					const fnParamsStr = JSON.stringify(params);
					const scriptFnStr = `(${scriptFn.toString()})(${idStr}, ${fnStr}, ${fnParamsStr});`;

					const script = document.createElement('script');
					script.textContent = scriptFnStr;
					document.body.appendChild(script);

					this.injectedScriptIds.add(id);
				}

				const listener = (listenerEvent: Event) => {
					window.removeEventListener(`uts-on-${id}-received`, listener);
					const value = (listenerEvent as CustomEvent<T | null>).detail;
					resolve(value);
				};
				window.addEventListener(`uts-on-${id}-received`, listener, false);

				const event = new CustomEvent(`uts-get-${id}`);
				window.dispatchEvent(event);
			} catch (_err) {
				resolve(null);
			}
		});
	}

	async injectInTab<T>(
		serviceId: string,
		key: string,
		url: string,
		params: Record<string, unknown> = {},
		tabId: number | null = null
	): Promise<T | null> {
		return new Promise((resolve) => {
			const id = `${serviceId}-${key}`;

			if (Shared.manifestVersion === 3 && tabId !== null) {
				void browser.scripting
					.executeScript({
						target: { tabId },
						func: Shared.functionsToInject[id],
						args: [params],
						world: 'MAIN',
					})
					.then((results) => {
						const value = results[0].result as T | null;
						resolve(value);
					})
					.catch(() => resolve(null));
				return;
			}

			if (!url) {
				resolve(null);
				return;
			}

			// If the content script never connects (for example, if the user is logged out and the
			// page redirects to a domain where it isn't injected), the promise would never settle
			// and callers (like the auto sync) would hang forever, so give up after a while.
			const timeoutId = setTimeout(() => {
				console.log(
					`[UTS] ScriptInjector.injectInTab: ${id}: timed out waiting for the content script`
				);
				Shared.events.unsubscribe('CONTENT_SCRIPT_CONNECT', null, onScriptConnect);
				if (tabId !== null) {
					void browser.tabs.remove(tabId);
				}
				resolve(null);
			}, 60e3);

			const onScriptConnect = async (data: ContentScriptConnectData) => {
				if (typeof tabId === 'undefined' || tabId !== data.tabId) {
					return;
				}

				// Keep the timeout active until the injection has settled, so that a hanging
				// injection cannot leave the promise pending forever. Failures resolve with null.
				let value: T | null = null;
				try {
					if (Shared.manifestVersion === 3) {
						const results = await browser.scripting.executeScript({
							target: { tabId },
							func: Shared.functionsToInject[id],
							args: [params],
							world: 'MAIN',
						});
						value = results[0].result as T | null;
					} else {
						value = (await Messaging.toContent(
							{ action: 'inject-function', serviceId, key, url, params },
							tabId
						)) as T | null;
					}
				} catch (err) {
					console.log(`[UTS] ScriptInjector.injectInTab: ${id}: injection failed`, err);
				}
				clearTimeout(timeoutId);
				void browser.tabs.remove(tabId);
				resolve(value);

				Shared.events.unsubscribe('CONTENT_SCRIPT_CONNECT', null, onScriptConnect);
			};

			Shared.events.subscribe('CONTENT_SCRIPT_CONNECT', null, onScriptConnect);

			Tabs.open(url, { active: false })
				.then((tab) => {
					tabId = tab?.id ?? null;
					if (tabId === null) {
						// Without a tab there is nothing to wait for, so give up instead of hanging
						console.log(`[UTS] ScriptInjector.injectInTab: ${id}: could not open a tab`);
						clearTimeout(timeoutId);
						Shared.events.unsubscribe('CONTENT_SCRIPT_CONNECT', null, onScriptConnect);
						resolve(null);
					}
				})
				.catch((err) => {
					console.log(`[UTS] ScriptInjector.injectInTab: ${id}: failed to open tab`, err);
					clearTimeout(timeoutId);
					Shared.events.unsubscribe('CONTENT_SCRIPT_CONNECT', null, onScriptConnect);
					resolve(null);
				});
		});
	}

	private getScriptFn() {
		return <T, U extends Record<string, unknown>>(
			id: string,
			fn: (params: U) => T | null,
			fnParams: U
		) => {
			window.addEventListener(`uts-get-${id}`, () => {
				let value: T | null = null;
				try {
					value = fn(fnParams);
				} catch (_err) {
					// Do nothing
				}

				const event = new CustomEvent(`uts-on-${id}-received`, {
					detail: value,
				});
				window.dispatchEvent(event);
			});
		};
	}
}

export const ScriptInjector = new _ScriptInjector();
