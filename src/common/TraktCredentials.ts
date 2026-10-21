import { Shared } from '@common/Shared';
import { readLocalStorage } from '@common/LocalStorage';

export async function loadTraktCredentials(): Promise<boolean> {
  const {traktApp} = await readLocalStorage('traktApp');
  Shared.clientId = traktApp?.clientId || process.env.TRAKT_CLIENT_ID || '';
  Shared.clientSecret = traktApp?.clientSecret || process.env.TRAKT_CLIENT_SECRET || '';
  return !!(Shared.clientId && Shared.clientSecret);
}
