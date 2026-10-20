import browser from "webextension-polyfill";
let opening: Promise<browser.Tabs.Tab> | null = null;

export function openApp(): Promise<browser.Tabs.Tab> {
  if (opening) return opening;
  opening = (async () => {
    const url = browser.runtime.getURL("app.html");
    const tabs = await browser.tabs.query({ url: `${url}*` });
    const existing = tabs.find((tab) => typeof tab.id === "number");
    if (existing?.id !== undefined) {
      let tab: browser.Tabs.Tab;
      try {
        tab = await browser.tabs.update(existing.id, { active: true });
      } catch {
        return browser.tabs.create({ url });
      }
      if (typeof existing.windowId === "number")
        await browser.windows.update(existing.windowId, { focused: true });
      return tab;
    }
    return browser.tabs.create({ url });
  })().finally(() => {
    opening = null;
  });
  return opening;
}
