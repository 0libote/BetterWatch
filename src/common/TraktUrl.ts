/** Convert copied Trakt website/app links into an API path for match correction. */
export function cleanTraktUrl(value: string): string {
  let url: URL;
  try { url = new URL(/^https?:\/\//.test(value) ? value : `https://${value}`); }
  catch { return ''; }
  if (!['trakt.tv', 'www.trakt.tv', 'app.trakt.tv'].includes(url.hostname)) return '';
  const movie = /^\/movies\/([\w-]+)\/?$/.exec(url.pathname);
  if (movie) return `/movies/${movie[1]}`;
  const show = /^\/shows\/([\w-]+)(?:\/seasons\/(\d+)\/episodes\/(\d+))?\/?$/.exec(url.pathname);
  if (!show) return '';
  const season = show[2] ?? url.searchParams.get('season');
  const episode = show[3] ?? url.searchParams.get('episode');
  if (!season || !episode || !/^\d+$/.test(season) || !/^\d+$/.test(episode) || Number(episode) < 1) return '';
  return `/shows/${show[1]}/seasons/${season}/episodes/${episode}`;
}
