import browser from 'webextension-polyfill';
import type { StorageValues } from './BrowserStorage';

export interface TraktApplication {
  clientId: string;
  clientSecret: string;
}

export type LocalStorageValues = StorageValues & {
  traktApp?: TraktApplication;
  skipSettings?: unknown;
};

/** The extension's storage schema, at the browser API's unknown-value boundary.
 * Consumers still normalize skip preferences and migrated options as before.
 */
export async function readLocalStorage(
  keys?: keyof LocalStorageValues | (keyof LocalStorageValues)[] | null,
): Promise<LocalStorageValues> {
  return await browser.storage.local.get(keys) as LocalStorageValues;
}
