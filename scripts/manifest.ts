const hosts = [
  '*://*.netflix.com/*',
  '*://*.primevideo.com/*',
  '*://*.amazon.com/*',
  '*://*.amazon.co.jp/*',
  '*://*.amazon.co.uk/*',
  '*://*.amazon.com.au/*',
  '*://*.amazon.de/*',
  '*://*.hbo.com/*',
  '*://*.hbomax.com/*',
];
export function createManifest(version: string) {
  return {
    manifest_version: 3,
    name: 'BetterWatch',
    version,
    minimum_chrome_version: '120',
    description:
      'Auto-skip intros, recaps and credits, and track your watching with Trakt.',
    icons: {
      16: 'images/betterwatch-16.png',
      48: 'images/betterwatch-48.png',
      128: 'images/betterwatch-128.png',
    },
    background: { service_worker: 'background.js' },
    action: {
      default_title: 'BetterWatch',
      default_icon: 'images/betterwatch-48.png',
    },
    options_ui: { page: 'app.html#/settings', open_in_tab: true },
    permissions: [
      'alarms',
      'identity',
      'scripting',
      'storage',
      'unlimitedStorage',
    ],
    optional_permissions: ['notifications'],
    host_permissions: [
      ...hosts,
      'https://*.trakt.tv/*',
      'https://*.themoviedb.org/*',
      'https://*.uts.rafaelgomes.xyz/*',
    ],
    optional_host_permissions: ['https://api.rollbar.com/*'],
    content_scripts: [
      { matches: hosts, js: ['auto-skip.js'], run_at: 'document_idle' },
      {
        matches: ['https://*.trakt.tv/apps*', 'https://app.trakt.tv/*'],
        js: ['trakt.js'],
      },
    ],
    default_locale: 'en',
    ...(process.env.CHROME_EXTENSION_KEY
      ? { key: process.env.CHROME_EXTENSION_KEY }
      : {}),
  };
}
