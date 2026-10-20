import browser from "webextension-polyfill";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ScrobblingDetails,
  StorageValuesOptions,
  StorageValuesSyncOptions,
} from "@common/BrowserStorage";
import { Shared } from "@common/Shared";
import {
  normalizeSettings,
  SkipPreferences,
  SkipService,
  SkipSettings,
} from "../../skip/model";
import { PartialDeep } from "type-fest";

type Notice = { text: string; error: boolean };
interface AppState {
  skip: SkipSettings;
  options: StorageValuesOptions;
  syncOptions: StorageValuesSyncOptions;
  playing: ScrobblingDetails | null;
  connected: boolean;
  configured: boolean;
  saving: boolean;
  toast: Notice | null;
  saveSkip: (
    service: SkipService,
    key: keyof SkipPreferences,
    value: boolean,
  ) => Promise<void>;
  saveOptions: (options: PartialDeep<StorageValuesOptions>) => Promise<void>;
  saveSyncOptions: (
    options: Partial<StorageValuesSyncOptions>,
  ) => Promise<void>;
  notify: (text: string, error?: boolean) => void;
}
const StateContext = createContext<AppState>({} as AppState);
export const useAppState = () => useContext(StateContext);
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [skip, setSkip] = useState(normalizeSettings(null));
  const [options, setOptions] = useState({ ...Shared.storage.options });
  const [syncOptions, setSyncOptions] = useState({
    ...Shared.storage.syncOptions,
  });
  const [playing, setPlaying] = useState<ScrobblingDetails | null>(null);
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Notice | null>(null);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const notify = (text: string, error = false) => setToast({ text, error });
  useEffect(() => {
    let active = true;
    const read = async () => {
      const values = await browser.storage.local.get([
        "skipSettings",
        "options",
        "syncOptions",
        "scrobblingDetails",
        "auth",
        "traktApp",
      ]);
      if (!active) return;
      setSkip(normalizeSettings(values.skipSettings));
      const nextOptions = values.options || Shared.storage.options;
      Shared.storage.updateOptions(nextOptions);
      setOptions({ ...Shared.storage.options });
      if (values.syncOptions)
        Shared.storage.updateSyncOptions(values.syncOptions);
      setSyncOptions({ ...Shared.storage.syncOptions });
      setPlaying(values.scrobblingDetails || null);
      setConnected(!!values.auth?.access_token);
      setConfigured(
        !!(
          (values.traktApp?.clientId || process.env.TRAKT_CLIENT_ID) &&
          (values.traktApp?.clientSecret || process.env.TRAKT_CLIENT_SECRET)
        ),
      );
    };
    const listener = (
      changes: Record<string, browser.Storage.StorageChange>,
      area: string,
    ) => {
      if (
        area === "local" &&
        [
          "skipSettings",
          "options",
          "syncOptions",
          "scrobblingDetails",
          "auth",
          "traktApp",
        ].some((key) => key in changes)
      )
        void read().catch(() =>
          notify("Could not refresh your settings.", true),
        );
    };
    browser.storage.onChanged.addListener(listener);
    void read().catch(() =>
      notify(
        "Could not load your settings. Reload BetterWatch to try again.",
        true,
      ),
    );
    return () => {
      active = false;
      browser.storage.onChanged.removeListener(listener);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  const run = async (operation: () => Promise<void>) => {
    pending.current++;
    setSaving(true);
    const task = queue.current.then(operation);
    queue.current = task.catch(() => {});
    try {
      await task;
    } catch {
      notify("Could not save this change. Please try again.", true);
    } finally {
      pending.current--;
      setSaving(pending.current > 0);
    }
  };
  const saveSkip = (
    service: SkipService,
    key: keyof SkipPreferences,
    value: boolean,
  ) =>
    run(async () => {
      const next = normalizeSettings(
        (await browser.storage.local.get("skipSettings")).skipSettings,
      );
      next[service] = { ...next[service], [key]: value };
      await browser.storage.local.set({ skipSettings: next });
      setSkip(next);
    });
  const saveOptions = (partial: PartialDeep<StorageValuesOptions>) =>
    run(async () => {
      await Shared.storage.saveOptions(partial);
      setOptions({ ...Shared.storage.options });
    });
  const saveSyncOptions = (partial: Partial<StorageValuesSyncOptions>) =>
    run(async () => {
      await Shared.storage.saveSyncOptions(partial);
      setSyncOptions({ ...Shared.storage.syncOptions });
    });
  return (
    <StateContext.Provider
      value={{
        skip,
        options,
        syncOptions,
        playing,
        connected,
        configured,
        saving,
        toast,
        saveSkip,
        saveOptions,
        saveSyncOptions,
        notify,
      }}
    >
      {children}
    </StateContext.Provider>
  );
}
