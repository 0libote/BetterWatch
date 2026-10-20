import browser from 'webextension-polyfill';
import { normalizeSettings, serviceForHost } from './model';
import { SkipEngine } from './engine';

async function start(): Promise<void> {
  const service = serviceForHost(location.hostname);
  if (!service) return;
  let settings = normalizeSettings((await browser.storage.local.get('skipSettings')).skipSettings);
  const engine = new SkipEngine(service, () => settings[service]);
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.skipSettings) {
      settings = normalizeSettings(changes.skipSettings.newValue);
    }
  });
  let scheduled = false;
  const scan = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; engine.scan(); }, 200);
  };
  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, {childList: true, subtree: true, attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'disabled', 'aria-disabled']});
  // A fallback handles reused controls and navigation without DOM changes.
  const timer = setInterval(scan, 2000);
  window.addEventListener('pagehide', event => {
    if (!event.persisted) { observer.disconnect(); clearInterval(timer); }
  });
  scan();
}
void start();
