import { useEffect, useState } from "react";
import { Cache } from "@common/Cache";
import { Shared } from "@common/Shared";
import { useAppState } from "./state";
import { Icon, Notice, PageHeading, Preference } from "./ui";
import { SERVICE_IDS, SERVICE_NAMES } from "../../skip/model";

export function SettingsPage() {
  const { options, saveOptions, syncOptions, saveSyncOptions, saving, notify } =
    useAppState();
  const [size, setSize] = useState("…");
  const [clearing, setClearing] = useState(false);
  useEffect(() => {
    void Shared.storage.getSize(Cache.storageKeys).then(setSize);
  }, []);
  const clearCache = async () => {
    setClearing(true);
    try {
      await Shared.storage.remove(Cache.storageKeys);
      setSize(await Shared.storage.getSize(Cache.storageKeys));
      notify(
        "Cached matches cleared. Your account and preferences are unchanged.",
      );
    } catch {
      notify("Could not clear the cache. Please try again.", true);
    } finally {
      setClearing(false);
    }
  };
  return (
    <>
      <PageHeading
        title="Settings"
        description="Make BetterWatch feel at home in your browser."
      />
      <section className="panel settings-section">
        <div className="panel-title">
          <span className="icon-tile">
            <Icon name="moon" />
          </span>
          <div>
            <h2>Appearance</h2>
            <p>Choose the lighting for your control room.</p>
          </div>
        </div>
        <div className="appearance-options">
          {(["dark", "light", "system"] as const).map((mode) => (
            <button
              key={mode}
              className={options.theme === mode ? "selected" : ""}
              aria-pressed={options.theme === mode}
              disabled={saving}
              onClick={() => void saveOptions({ theme: mode })}
            >
              <span className={`appearance-preview ${mode}`}>
                <i />
                <i />
                <i />
              </span>
              <span>
                {mode === "dark"
                  ? "Dark"
                  : mode === "light"
                    ? "Light"
                    : "Follow system"}
              </span>
              {options.theme === mode && <Icon name="check" size={16} />}
            </button>
          ))}
        </div>
      </section>
      <section className="panel settings-section">
        <div className="panel-title">
          <span className="icon-tile">
            <Icon name="history" />
          </span>
          <div>
            <h2>History sync</h2>
            <p>Import when you choose, or keep a regular schedule.</p>
          </div>
        </div>
        {SERVICE_IDS.map((id) => (
          <div className="schedule-row" key={id}>
            <Preference
              title={`Scheduled sync for ${SERVICE_NAMES[id]}`}
              description={
                options.services[id]?.lastSync
                  ? "Sync new history after your last successful import."
                  : "Complete a manual history sync to establish your starting point."
              }
              checked={options.services[id]?.autoSync || false}
              disabled={saving}
              onChange={(value) =>
                void saveOptions({
                  services: { [id]: { autoSync: value, sync: true } },
                })
              }
            />
            <label className="schedule-days">
              Every
              <select
                aria-label={`${SERVICE_NAMES[id]} sync interval`}
                value={options.services[id]?.autoSyncDays || 7}
                disabled={saving || !options.services[id]?.autoSync}
                onChange={(e) =>
                  void saveOptions({
                    services: {
                      [id]: { autoSyncDays: Number(e.target.value) },
                    },
                  })
                }
              >
                {[1, 3, 7, 14, 30].map((days) => (
                  <option key={days} value={days}>
                    {days} {days === 1 ? "day" : "days"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </section>
      <section className="panel settings-section">
        <div className="panel-title">
          <span className="icon-tile">
            <Icon name="check" />
          </span>
          <div>
            <h2>History import rules</h2>
            <p>Choose when a past watch is ready to import.</p>
          </div>
        </div>
        <div className="minimum-progress">
          <div>
            <h3>Minimum watched</h3>
            <p>
              History items below this percentage cannot be selected for import.
            </p>
          </div>
          <select
            aria-label="Minimum watched percentage"
            value={syncOptions.minPercentageWatched}
            disabled={saving}
            onChange={(e) =>
              void saveSyncOptions({
                minPercentageWatched: Number(e.target.value),
              })
            }
          >
            {Array.from(
              new Set([
                0,
                25,
                50,
                75,
                80,
                90,
                95,
                100,
                syncOptions.minPercentageWatched,
              ]),
            )
              .sort((a, b) => a - b)
              .map((value) => (
                <option key={value} value={value}>
                  {value}%
                </option>
              ))}
          </select>
        </div>
        <Preference
          title="Use release dates as watched dates"
          description="Use a title’s release date instead of the date recorded by the streaming service."
          checked={syncOptions.addWithReleaseDate}
          disabled={saving}
          onChange={(value) =>
            void saveSyncOptions({ addWithReleaseDate: value })
          }
        />
        <Preference
          title="Fall back to the streaming watched date"
          description="When a release date is missing, keep the date from your streaming history."
          checked={syncOptions.addWithReleaseDateMissing}
          disabled={saving || !syncOptions.addWithReleaseDate}
          onChange={(value) =>
            void saveSyncOptions({ addWithReleaseDateMissing: value })
          }
        />
      </section>
      <section className="panel settings-section">
        <div className="panel-title">
          <span className="icon-tile">
            <Icon name="shield" />
          </span>
          <div>
            <h2>Privacy & extras</h2>
            <p>Additional services are always your choice.</p>
          </div>
        </div>
        <Preference
          title="Browser notifications"
          description="Show a notification when Trakt starts or stops tracking."
          checked={options.showNotifications}
          disabled={saving}
          onChange={(value) => void saveOptions({ showNotifications: value })}
        />
        <Preference
          title="Community match suggestions"
          description="Send your title corrections to the upstream community service and receive shared suggestions."
          checked={options.sendReceiveSuggestions}
          disabled={saving}
          onChange={(value) =>
            void saveOptions({ sendReceiveSuggestions: value })
          }
        />
        <Preference
          title="Load title artwork"
          description={
            process.env.TMDB_API_KEY
              ? "Use TMDB to display artwork while reviewing matches."
              : "Requires a TMDB API key in your extension build."
          }
          checked={options.loadImages}
          disabled={saving || !process.env.TMDB_API_KEY}
          onChange={(value) => void saveOptions({ loadImages: value })}
        />
        {process.env.ROLLBAR_TOKEN && (
          <Preference
            title="Send error reports"
            description="Share error details with the configured Rollbar project."
            checked={options.allowRollbar}
            disabled={saving}
            onChange={(value) => void saveOptions({ allowRollbar: value })}
          />
        )}
      </section>
      <section className="panel settings-section">
        <div className="panel-title">
          <span className="icon-tile">
            <Icon name="refresh" />
          </span>
          <div>
            <h2>Cached title matches</h2>
            <p>Clear stored matches if a title keeps resolving incorrectly.</p>
          </div>
          <span className="cache-size">{size}</span>
        </div>
        <button
          className="button secondary"
          onClick={() => void clearCache()}
          disabled={clearing}
        >
          {clearing ? "Clearing…" : "Clear cached matches"}
        </button>
      </section>
      <Notice>
        Trakt application details and tokens stay in this Chrome profile. Skip
        preferences are also local; general preferences may use Chrome Sync.
      </Notice>
    </>
  );
}
