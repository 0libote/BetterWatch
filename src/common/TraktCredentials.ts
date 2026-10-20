import { Shared } from '@common/Shared';
import browser from 'webextension-polyfill';

export async function loadTraktCredentials(): Promise<boolean> {
  const {traktApp} = await browser.storage.local.get('traktApp');
  Shared.clientId = traktApp?.clientId || process.env.TRAKT_CLIENT_ID || '';
  Shared.clientSecret = traktApp?.clientSecret || process.env.TRAKT_CLIENT_SECRET || '';
  return !!(Shared.clientId && Shared.clientSecret);
}
