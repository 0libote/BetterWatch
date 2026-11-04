import { ServiceApi } from '@apis/ServiceApi';
import { StorageOptionsChangeData } from '@common/Events';
import { getScrobbleController, ScrobbleController } from '@common/ScrobbleController';
import { ScrobbleParser } from '@common/ScrobbleParser';
import { Shared } from '@common/Shared';

export interface ScrobbleEventsOptions {
	/**
	 * How frequently to check for changes, in seconds.
	 *
	 * *Default:* `0.5`
	 */
	checkFrequency: number;
}

const scrobbleEvents = new Map<string, ScrobbleEvents>();

export const getScrobbleEvents = (id: string): ScrobbleEvents => {
	if (!scrobbleEvents.has(id)) {
		const controller = getScrobbleController(id);
		scrobbleEvents.set(id, new ScrobbleEvents(controller));
	}
	const events = scrobbleEvents.get(id);
	if (!events) {
		throw new Error(`Scrobble events not registered for ${id}`);
	}
	return events;
};

export class ScrobbleEvents {
	readonly api: ServiceApi;
	readonly parser: ScrobbleParser;
	readonly controller: ScrobbleController;
	readonly options: Readonly<ScrobbleEventsOptions>;
	protected changeListenerId: number | null = null;
	protected url = '';
	protected playbackStarted = false;
	protected isPaused = true;
	protected progress = 0.0;
	private hasAddedListeners = false;
	private pending: Promise<void> = Promise.resolve();
	private generation = 0;
	private failures = 0;

	constructor(controller: ScrobbleController, options: Partial<ScrobbleEventsOptions> = {}) {
		this.controller = controller;
		this.parser = this.controller.parser;
		this.api = this.parser.api;
		this.options = Object.freeze({
			...this.getDefaultOptions(),
			...options,
		});
	}

	protected getDefaultOptions(): ScrobbleEventsOptions {
		return {
			checkFrequency: 0.5,
		};
	}

	protected getLocation(): string {
		return window.location.href;
	}

	init(): void {
		void this.checkListeners();
		Shared.events.subscribe('STORAGE_OPTIONS_CHANGE', null, this.onStorageOptionsChange);
	}

	onStorageOptionsChange = (data: StorageOptionsChangeData): Promise<void> => {
		const serviceOption = data.options?.services?.[this.api.id];
		if (serviceOption && 'scrobble' in serviceOption) {
			return this.checkListeners();
		}
		return Promise.resolve();
	};

	checkListeners(): Promise<void> {
		const { scrobble } = Shared.storage.options.services[this.api.id];
		if (scrobble && !this.hasAddedListeners) {
			this.hasAddedListeners = true;
			this.generation++;
			void this.runCheck();
			if (this.parser.onClick) {
				document.addEventListener('click', this.parser.onClick, true);
			}
		} else if (!scrobble && this.hasAddedListeners) {
			if (this.changeListenerId !== null) {
				window.clearTimeout(this.changeListenerId);
				this.changeListenerId = null;
			}
			if (this.parser.onClick) {
				document.removeEventListener('click', this.parser.onClick);
			}
			this.hasAddedListeners = false;
			this.generation++;
			this.pending = this.pending.then(() => this.controller.stopScrobble()).catch(err => {
				if (Shared.errors.validate(err)) Shared.errors.log('Failed to stop disabled tracking.', err);
			}).finally(() => {
				this.isPaused = true;
				this.playbackStarted = false;
				this.progress = 0;
			});
		}
		return this.pending;
	}

	private runCheck(): Promise<void> {
		const generation = this.generation;
		this.pending = this.pending.then(async () => {
			if (!this.hasAddedListeners || generation !== this.generation) return;
			await this.checkForChanges();
			this.failures = 0;
		}).catch(err => {
			this.failures++;
			if (Shared.errors.validate(err)) Shared.errors.log('Playback tracking will retry.', err);
		}).finally(() => {
			if (!this.hasAddedListeners || generation !== this.generation) return;
			const delay = Math.min(30000, this.options.checkFrequency * 1000 * 2 ** Math.min(this.failures, 6));
			this.changeListenerId = window.setTimeout(() => void this.runCheck(), delay);
		});
		return this.pending;
	}

	private isCurrent(generation: number): boolean {
		return generation === this.generation && !!Shared.storage.options.services[this.api.id].scrobble;
	}

	protected async checkForChanges(): Promise<void> {
		const generation = this.generation;
		// Auto-skip can run before Trakt setup. Begin metadata lookup/tracking only
		// after authorization, including when the user connects during playback.
		const { auth } = await Shared.storage.get('auth');
		if (!this.isCurrent(generation)) return;
		if (!auth?.access_token) {
			this.isPaused = true;
			this.playbackStarted = false;
			return;
		}
		const newUrl = this.getLocation();
		if (this.url !== newUrl) {
			await this.onUrlChange(this.url, newUrl);
			this.url = newUrl;
		}

		const playback = await this.parser.parsePlayback();
		if (!this.isCurrent(generation)) return;
		if (playback) {
			const newProgress = playback.progress;
			if (this.progress !== newProgress) {
				await this.controller.updateProgress(newProgress);
				this.progress = newProgress;
			}

			if (!this.isCurrent(generation)) return;
			if (playback.isPaused && !this.isPaused) {
				await this.controller.pauseScrobble();
			} else if (!playback.isPaused && this.isPaused) {
				await this.controller.startScrobble();
			}
			this.playbackStarted = true;
			this.isPaused = playback.isPaused;
		} else if (this.playbackStarted) {
			await this.controller.stopScrobble();
			this.playbackStarted = false;
			this.isPaused = true;
			this.progress = 0.0;
		}

	}

	protected async onUrlChange(oldUrl: string, newUrl: string): Promise<void> {
		if (!this.parser.options.watchingUrlRegex) {
			return;
		}

		if (this.parser.options.watchingUrlRegex.test(oldUrl)) {
			await this.controller.stopScrobble();
			this.playbackStarted = false;
		}

		if (this.parser.options.watchingUrlRegex.test(newUrl)) {
			this.playbackStarted = true;
		}

		this.isPaused = true;
		this.progress = 0.0;
	}
}
