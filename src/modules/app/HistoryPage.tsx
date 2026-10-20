import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ServiceApi } from "@apis/ServiceApi";
import { TraktSync } from "@apis/TraktSync";
import { TmdbApi } from "@apis/TmdbApi";
import { CorrectionApi } from "@apis/CorrectionApi";
import { Shared } from "@common/Shared";
import {
  HistorySyncSuccessData,
  ItemCorrectedData,
  MissingWatchedDateAddedData,
} from "@common/Events";
import { SyncProvider, useSync } from "@contexts/SyncContext";
import { createScrobbleItem, ScrobbleItem } from "@models/Item";
import { SERVICE_IDS, SERVICE_NAMES, SkipService } from "../../skip/model";
import { useAppState } from "./state";
import { EmptyState, Icon, Notice, PageHeading, ServiceTabs } from "./ui";
import { canImport, formatWatchedDate, historyStatus } from "./history-model";

export function HistoryPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("service");
  const service: SkipService = SERVICE_IDS.includes(raw as SkipService)
    ? (raw as SkipService)
    : "netflix";
  const scheduled = raw === "scheduled";
  const { connected } = useAppState();
  return (
    <>
      <PageHeading
        title="Watch history"
        description="Bring past watches into Trakt, with a chance to check every match."
      />
      <div className="history-service-bar">
        <ServiceTabs
          value={scheduled ? null : service}
          onChange={(id) => setParams({ service: id })}
        />
        <button
          className={`button ${scheduled ? "primary" : "secondary"}`}
          aria-pressed={scheduled}
          onClick={() => setParams({ service: "scheduled" })}
        >
          Scheduled results
        </button>
      </div>
      {connected ? (
        <SyncProvider
          key={scheduled ? "scheduled" : service}
          serviceId={scheduled ? null : service}
        >
          <HistoryWorkspace />
        </SyncProvider>
      ) : (
        <section className="panel">
          <EmptyState
            icon="history"
            title="Your history starts with Trakt"
            action={
              <Link className="button primary" to="/trakt">
                Connect Trakt
                <Icon name="chevron" size={16} />
              </Link>
            }
          >
            Connect your account to review streaming history and import the
            watches you choose.
          </EmptyState>
        </section>
      )}
    </>
  );
}
function HistoryWorkspace() {
  const { serviceId, service, api, store } = useSync();
  const { options, notify, syncOptions } = useAppState();
  const [revision, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [hideSynced, setHideSynced] = useState(false);
  const [started, setStarted] = useState(store.data.items.length > 0);
  const cancelKey = `history-${serviceId}`;
  const decorate = async (items: ScrobbleItem[]) => {
    let resolved = await ServiceApi.loadTraktHistory(
      items,
      async (item) => {
        await store.update([item], true);
        return item;
      },
      cancelKey,
    );
    if (options.sendReceiveSuggestions)
      resolved = await CorrectionApi.loadSuggestions(resolved);
    if (options.loadImages) resolved = await TmdbApi.loadImages(resolved);
    resolved = resolved.map((item) => {
      const copy = item.clone();
      copy.isLoading = false;
      return copy;
    });
    await store.update(resolved, true);
    return resolved;
  };
  useEffect(() => {
    const updated = () => refresh((v) => v + 1);
    const corrected = async (data: ItemCorrectedData) => {
      if (data.newItem.serviceId !== serviceId) return;
      setBusy(true);
      try {
        if (data.oldItem.trakt?.syncId)
          await TraktSync.removeHistory(createScrobbleItem(data.oldItem));
        const item = createScrobbleItem(data.newItem);
        await store.update([item], true);
        await decorate([item]);
      } catch {
        setError("Could not update this match. Try loading the history again.");
      } finally {
        setBusy(false);
      }
    };
    const dated = async (data: MissingWatchedDateAddedData) => {
      const items = data.newItems.filter(
        (item) => item.serviceId === serviceId,
      );
      if (!items.length) return;
      setBusy(true);
      try {
        await store.update(items, true);
        await decorate(items);
      } catch {
        setError("Could not check the new watched date. Try again.");
      } finally {
        setBusy(false);
      }
    };
    Shared.events.subscribe("ITEMS_LOAD", null, updated);
    Shared.events.subscribe("SYNC_STORE_RESET", null, updated);
    Shared.events.subscribe("ITEM_CORRECTED", null, corrected);
    Shared.events.subscribe("MISSING_WATCHED_DATE_ADDED", null, dated);
    return () => {
      Shared.events.unsubscribe("ITEMS_LOAD", null, updated);
      Shared.events.unsubscribe("SYNC_STORE_RESET", null, updated);
      Shared.events.unsubscribe("ITEM_CORRECTED", null, corrected);
      Shared.events.unsubscribe("MISSING_WATCHED_DATE_ADDED", null, dated);
      void Shared.events.dispatch("REQUESTS_CANCEL", null, {
        tabId: Shared.tabId,
        key: cancelKey,
      });
    };
  }, [serviceId]);
  const load = async (reset = false) => {
    if (!api || !service) {
      setBusy(true);
      setStarted(true);
      setError("");
      try {
        const { syncCache } = await Shared.storage.get("syncCache");
        await store.resetData();
        const cached = (syncCache?.items || []).map(createScrobbleItem);
        await store.setData({ items: cached, hasReachedEnd: true });
        await decorate(cached);
      } catch {
        setError("Could not load the saved scheduled-sync results. Try again.");
      } finally {
        setBusy(false);
        refresh((v) => v + 1);
      }
      return;
    }
    setBusy(true);
    setStarted(true);
    setError("");
    let items: ScrobbleItem[] = [];
    try {
      if (!options.services[service.id]?.sync)
        throw new Error(
          "History access is paused. Enable it below before loading.",
        );
      if (!(await api.checkLogin()))
        throw new Error(
          `Sign in to ${service.name} in this Chrome profile, then try again.`,
        );
      if (reset) {
        api.reset();
        await store.resetData();
      }
      store.data.isLoading = true;
      items = await api.loadHistory(20, 0, "", cancelKey);
      await decorate(items);
    } catch (e) {
      setError(
        e instanceof Error && e.message.startsWith("Sign in")
          ? e.message
          : `Could not load ${service.name} history. Check that you’re signed in to the service, then try again.`,
      );
    } finally {
      store.data.isLoading = false;
      await store.update(
        store.data.items.map((item) => {
          const copy = item.clone();
          copy.isLoading = false;
          return copy;
        }),
        true,
      );
      setBusy(false);
      refresh((v) => v + 1);
    }
  };
  const toggle = async (item: ScrobbleItem, value: boolean) => {
    const copy = item.clone();
    copy.isSelected = value;
    await store.update([copy], true);
  };
  const items = store.data.items.filter(
    (item) =>
      (!hideSynced || !item.trakt?.watchedAt) &&
      item
        .getFullTitle()
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const eligible = items.filter(canImport);
  const selected = store.data.items.filter(
    (item) => item.isSelected && canImport(item),
  );
  const selectVisible = async (value: boolean) => {
    await store.update(
      eligible.map((item) => {
        const copy = item.clone();
        copy.isSelected = value;
        return copy;
      }),
      true,
    );
  };
  const sync = async () => {
    if (!selected.length) return;
    setSyncing(true);
    setError("");
    let succeeded = false;
    const success = (data: HistorySyncSuccessData) => {
      succeeded = true;
      notify(
        `Added ${data.added.episodes} episodes and ${data.added.movies} movies to Trakt.`,
      );
    };
    const failure = () =>
      setError(
        "Trakt could not finish this sync. Check your connection and review the selected items before retrying.",
      );
    Shared.events.subscribe("HISTORY_SYNC_SUCCESS", null, success);
    Shared.events.subscribe("HISTORY_SYNC_ERROR", null, failure);
    try {
      await TraktSync.sync(store, selected);
      if (succeeded && serviceId) {
        const newest = selected.reduce(
          (current, item) =>
            (item.watchedAt || 0) > (current.watchedAt || 0) ? item : current,
          selected[0],
        );
        if (
          (newest.watchedAt || 0) >
          Shared.storage.options.services[serviceId].lastSync
        )
          await Shared.storage.saveOptions({
            services: {
              [serviceId]: {
                lastSync: newest.watchedAt,
                lastSyncId: newest.id,
              },
            },
          });
      }
      if (succeeded && !serviceId) {
        const remaining = store.data.items
          .filter((item) => !item.trakt?.watchedAt)
          .map((item) => item.save());
        await Shared.storage.set(
          { syncCache: { items: remaining, failed: remaining.length > 0 } },
          false,
        );
      }
    } catch {
      failure();
    } finally {
      Shared.events.unsubscribe("HISTORY_SYNC_SUCCESS", null, success);
      Shared.events.unsubscribe("HISTORY_SYNC_ERROR", null, failure);
      setSyncing(false);
      refresh((v) => v + 1);
    }
  };
  const changeDate = (item: ScrobbleItem) =>
    void Shared.events.dispatch("MISSING_WATCHED_DATE_DIALOG_SHOW", null, {
      items: [item],
    });
  const correct = (item: ScrobbleItem) =>
    void Shared.events.dispatch("CORRECTION_DIALOG_SHOW", null, {
      item,
      isScrobblingItem: false,
    });
  const working = busy || syncing;
  return (
    <>
      <div className="history-toolbar">
        <div className="search-field">
          <Icon name="search" size={18} />
          <input
            aria-label="Search loaded history"
            placeholder="Search loaded titles…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={hideSynced}
            onChange={(e) => setHideSynced(e.target.checked)}
          />
          Hide synced
        </label>
        {started && serviceId && (
          <button
            className="button secondary"
            aria-label="Reload history from the beginning"
            title="Reload history"
            disabled={working || !options.services[serviceId]?.sync}
            onClick={() => void load(true)}
          >
            <Icon name="refresh" size={16} />
          </button>
        )}
        <button
          className="button secondary"
          disabled={
            working ||
            (!!serviceId &&
              (store.data.hasReachedEnd || !options.services[serviceId]?.sync))
          }
          onClick={() => void load()}
        >
          <Icon name="history" size={16} />
          {busy ? "Loading history…" : started ? "Load more" : "Load history"}
        </button>
      </div>
      {error && (
        <Notice kind="error">
          {error}
          {service && (
            <a href={service.loginPage} target="_blank" rel="noreferrer">
              Open {service.name}
              <Icon name="external" size={13} />
            </a>
          )}
        </Notice>
      )}
      <section className="panel history-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="select-col">
                  <input
                    type="checkbox"
                    aria-label="Select all eligible visible watches"
                    checked={
                      eligible.length > 0 &&
                      eligible.every((item) => item.isSelected)
                    }
                    disabled={working || !eligible.length}
                    onChange={(e) => void selectVisible(e.target.checked)}
                  />
                </th>
                <th>Title</th>
                <th>Watched</th>
                <th>Progress</th>
                <th>Trakt match</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.id}-${item.index}`}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.getFullTitle()}`}
                      checked={!!item.isSelected && canImport(item)}
                      disabled={working || !canImport(item)}
                      onChange={(e) => void toggle(item, e.target.checked)}
                    />
                  </td>
                  <td>
                    <div className="history-title">
                      <span className="title-cover">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" />
                        ) : (
                          <Icon name="play" size={17} />
                        )}
                      </span>
                      <div>
                        <strong>
                          {item.type === "episode"
                            ? item.show.title
                            : item.title}
                        </strong>
                        <span>
                          {item.type === "episode"
                            ? `S${item.season} E${item.number} · ${item.title}`
                            : item.year || "Movie"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <button
                      className="date-button"
                      disabled={working}
                      onClick={() => changeDate(item)}
                    >
                      {formatWatchedDate(item.getWatchedDate())}
                    </button>
                  </td>
                  <td>
                    <div className="table-progress">
                      <progress max="100" value={item.progress} />
                      <span>{Math.round(item.progress)}%</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`history-status ${canImport(item) ? "ready" : item.trakt?.watchedAt ? "synced" : "pending"}`}
                    >
                      {historyStatus(item)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      disabled={working}
                      onClick={() => correct(item)}
                    >
                      Edit match
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && (
          <EmptyState
            icon={busy ? "refresh" : "history"}
            title={
              busy
                ? "Finding your watches…"
                : query
                  ? "No matching titles"
                  : started
                    ? "No watches to show"
                    : "Your past watches belong here"
            }
            action={
              !busy && !query && !started ? (
                <button
                  className="button secondary"
                  onClick={() => void load()}
                  disabled={!!serviceId && !options.services[serviceId]?.sync}
                >
                  Load {service?.name || "scheduled"} history
                </button>
              ) : undefined
            }
          >
            {busy
              ? "Looking up your streaming history and checking the matches on Trakt."
              : query
                ? "Try a different search. Search only includes the history you’ve loaded."
                : started
                  ? "There are no loaded watches matching the current filters."
                  : "Load history from this browser’s signed-in streaming profile. You’ll review the titles before anything is added to Trakt."}
          </EmptyState>
        )}
        <div className="history-footer">
          <span>
            {store.data.items.length} watches loaded
            {store.data.hasReachedEnd ? " · End of history" : ""}
          </span>
          <span>{selected.length} selected</span>
          <button
            className="button primary"
            disabled={!selected.length || working}
            onClick={() => void sync()}
          >
            <Icon name="trakt" size={17} />
            {syncing
              ? "Syncing…"
              : `Sync ${selected.length || ""}${selected.length ? " " : ""}selected`}
          </button>
          {working && (
            <button
              className="text-button"
              onClick={() =>
                void Shared.events.dispatch("REQUESTS_CANCEL", null, {
                  tabId: Shared.tabId,
                  key: syncing ? "sync" : cancelKey,
                })
              }
            >
              Cancel
            </button>
          )}
        </div>
      </section>
      <div className="history-access">
        {serviceId ? (
          <HistoryAccess service={serviceId as SkipService} />
        ) : (
          <span className="muted-copy">
            Saved results from scheduled history imports.
          </span>
        )}
        <p>
          Only selected watches with a confirmed match, a watched date, and at
          least {syncOptions.minPercentageWatched}% progress are imported.
          Review the title or change its date before syncing.
        </p>
      </div>
      <span className="sr-only" aria-live="polite">
        {revision ? `${store.data.items.length} watches loaded` : ""}
      </span>
    </>
  );
}
function HistoryAccess({ service }: { service: SkipService }) {
  const { options, saving, saveOptions } = useAppState();
  return (
    <label className="checkbox-label">
      <input
        type="checkbox"
        checked={options.services[service]?.sync || false}
        disabled={saving}
        onChange={(event) =>
          void saveOptions({
            services: { [service]: { sync: event.target.checked } },
          })
        }
      />
      Allow {SERVICE_NAMES[service]} history access
    </label>
  );
}
