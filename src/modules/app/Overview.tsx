import { Link } from "react-router-dom";
import { useState } from "react";
import browser from "webextension-polyfill";
import { createScrobbleItem } from "@models/Item";
import { Shared } from "@common/Shared";
import { useAppState } from "./state";
import { Icon, PageHeading, ServiceMark, Toggle } from "./ui";
import {
  SERVICE_IDS,
  SERVICE_NAMES,
  SkipPreferences,
  SkipService,
} from "../../skip/model";

export const SERVICE_URLS: Record<SkipService, string> = {
  netflix: "https://www.netflix.com/",
  "amazon-prime": "https://www.primevideo.com/",
  "hbo-max": "https://www.hbomax.com/",
};
export function Timeline({ prefs }: { prefs: SkipPreferences }) {
  return (
    <div
      className="timeline-preview"
      aria-label={`Playback preview: intros ${prefs.enabled && prefs.intro ? "skipped" : "played"}, episode plays, credits ${prefs.enabled && prefs.credits ? "skipped" : "played"}`}
    >
      <div className="timeline-label">
        <Icon name="play" size={15} />
        <span>A smoother episode</span>
      </div>
      <div className="timeline-track">
        <span className={prefs.enabled && prefs.intro ? "skipped" : ""}>
          Intro{prefs.enabled && prefs.intro && <Icon name="skip" size={13} />}
        </span>
        <span className="episode">
          <span className="playhead" />
          The good part
          <Icon name="play" size={13} />
        </span>
        <span className={prefs.enabled && prefs.credits ? "skipped" : ""}>
          Credits
          {prefs.enabled && prefs.credits && <Icon name="skip" size={13} />}
        </span>
      </div>
      <div className="timeline-key">
        <span>
          <i /> Plays as usual
        </span>
        <span>
          <i className="skip-key" /> Skipped automatically
        </span>
      </div>
    </div>
  );
}
export function Overview() {
  const { skip, connected, playing, notify } =
    useAppState();
  const current =
    connected && playing?.item ? createScrobbleItem(playing.item) : null;
  const [previewService, setPreviewService] = useState<SkipService>("netflix");
  const active = SERVICE_IDS.filter((id) => skip[id].enabled).length;
  const focusPlayer = async () => {
    try {
      if (playing?.tabId != null) {
        const tab = await browser.tabs.update(playing.tabId, { active: true });
        if (tab.windowId !== undefined)
          await browser.windows.update(tab.windowId, { focused: true });
      }
    } catch {
      notify("That player tab is no longer open.", true);
    }
  };
  return (
    <>
      <PageHeading
        title="Your watch controls"
        description="Set your skips, connect Trakt, and get back to watching."
      >
        <span className={`status-badge ${active ? "positive" : ""}`}>
          <i />
          {active ? "Auto-skip is ready" : "Auto-skip is paused"}
        </span>
      </PageHeading>
      <ServiceControls />
      <div className="overview-hero">
        <section className={`watch-stage ${current ? "is-playing" : ""}`}>
          <div className="stage-top">
            <span className="subtle-label">
              <Icon
                name={current ? (playing?.isPaused ? "pause" : "play") : "play"}
                size={16}
              />
              {current
                ? playing?.isPaused
                  ? "Playback paused"
                  : "Now watching"
                : "Your next watch"}
            </span>
            {current ? (
              <span className="tiny-label">{SERVICE_NAMES[current.serviceId as SkipService]}</span>
            ) : (
              <select className="preview-service" aria-label="Playback preview service"
                value={previewService} onChange={event => setPreviewService(event.target.value as SkipService)}>
                {SERVICE_IDS.map(id => <option key={id} value={id}>{SERVICE_NAMES[id]}</option>)}
              </select>
            )}
          </div>
          <div className="stage-content">
            <span className="stage-play">
              <Icon
                name={current && playing?.isPaused ? "pause" : "play"}
                size={30}
              />
            </span>
            <div>
              <h2>
                {current
                  ? current.type === "episode"
                    ? current.show.title
                    : current.title
                  : "Skip straight to the story."}
              </h2>
              <p>
                {current
                  ? current.type === "episode"
                    ? `Season ${current.season}, episode ${current.number} · ${current.title}`
                    : "Tracking this movie with Trakt."
                  : "Intros and recaps taken care of. Your favorite services, working together."}
              </p>
            </div>
          </div>
          {current ? (
            <div className="watch-progress">
              <div>
                <span>Playback progress</span>
                <span>{Math.round(current.progress)}%</span>
              </div>
              <progress value={current.progress} max={100} />
              <div className="button-row">
                <button
                  className="button primary"
                  onClick={() => void focusPlayer()}
                >
                  <Icon name="play" size={16} />
                  Back to player
                </button>
                <button
                  className="button quiet"
                  onClick={() =>
                    void Shared.events.dispatch(
                      "CORRECTION_DIALOG_SHOW",
                      null,
                      { item: current, isScrobblingItem: true },
                    )
                  }
                >
                  Wrong title?
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="button-row">
                <button
                  className="button primary"
                  onClick={() =>
                    void browser.tabs.create({ url: SERVICE_URLS[previewService] })
                  }
                >
                  <Icon name="play" size={16} />
                  Open {SERVICE_NAMES[previewService]}
                </button>
                <Link className="button quiet" to={`/auto-skip?service=${previewService}`}>
                  Customize auto-skip
                  <Icon name="chevron" size={15} />
                </Link>
              </div>
              <Timeline prefs={skip[previewService]} />
            </>
          )}
        </section>
        <section className="trakt-summary panel">
          <div className="panel-top">
            <span className="trakt-mark">
              <Icon name="trakt" size={29} />
            </span>
            <span className={`status-badge ${connected ? "positive" : ""}`}>
              <i />
              {connected ? "Connected" : "Not connected"}
            </span>
          </div>
          <h2>
            {connected
              ? "Your watching, in sync."
              : "A home for your watch history."}
          </h2>
          <p>
            {connected
              ? "Shows and movies are added to Trakt as you watch on enabled services."
              : "Connect Trakt to remember the shows and movies you watch across your services."}
          </p>
          <Link
            to="/trakt"
            className={`button ${connected ? "secondary" : "primary"}`}
          >
            {connected ? "Manage Trakt" : "Connect Trakt"}
            <Icon name={connected ? "settings" : "chevron"} size={16} />
          </Link>
          <span className="connection-footnote">
            <Icon name="shield" size={14} />
            {connected
              ? "Account stays connected in this browser"
              : "Auto-skip works without an account"}
          </span>
        </section>
      </div>
    </>
  );
}

const skipActions = [
  {key: 'intro', label: 'Skip intros'},
  {key: 'recap', label: 'Skip recaps'},
  {key: 'credits', label: 'Skip credits'},
  {key: 'continueWatching', label: 'Keep watching'},
] as const;

function ServiceControls() {
  const {skip, connected, options, saveSkip, saving} = useAppState();
  return (
    <section className="service-controls" aria-labelledby="service-controls-title">
      <div className="section-heading">
        <div>
          <h2 id="service-controls-title">Service controls</h2>
          <p>Changes save automatically and apply to open player tabs.</p>
        </div>
        <Link to="/settings" className="text-button"><Icon name="settings" size={16} />All settings</Link>
      </div>
      <div className="control-console">
        <div className="control-columns" aria-hidden="true">
          <span>Streaming service</span>
          {skipActions.map(action => <span key={action.key}>{action.label}</span>)}
          <span>Auto-skip</span>
        </div>
        {SERVICE_IDS.map(id => {
          const prefs = skip[id];
          const name = SERVICE_NAMES[id];
          return (
            <article className={`service-control-row ${prefs.enabled ? 'is-enabled' : ''}`} key={id} aria-label={`${name} controls`}>
              <div className="control-service">
                <ServiceMark service={id} small />
                <div>
                  <h3>{name}</h3>
                  <div className="control-service-links">
                    <Link to={`/auto-skip?service=${id}`} aria-label={`More ${name} controls`}>Customize</Link>
                    <Link to={`/history?service=${id}`} aria-label={`${name} watch history`}>History</Link>
                  </div>
                  <Link className="control-trakt" to="/trakt" aria-label={`${name} Trakt settings`}>
                    <Icon name="trakt" size={12} />
                    {id === 'hbo-max' ? 'Tracking experimental' : connected && options.services[id]?.scrobble ? 'Tracking on' : connected ? 'Tracking off' : 'Connect Trakt to track'}
                  </Link>
                </div>
              </div>
              {skipActions.map(({key, label}) => (
                <div className="control-action" key={key}>
                  <span className="control-mobile-label">{label}</span>
                  {key === 'continueWatching' && id !== 'netflix' ? (
                    <span className="control-unavailable" aria-label="Available on Netflix only" title="Available on Netflix only">—</span>
                  ) : (
                    <Toggle label={`${name}: ${label.toLowerCase()}`} checked={prefs[key]}
                      disabled={saving || !prefs.enabled} onChange={value => void saveSkip(id, key, value)} />
                  )}
                </div>
              ))}
              <div className="control-enable">
                <span className="control-mobile-label">Auto-skip {prefs.enabled ? 'on' : 'paused'}</span>
                <Toggle label={`Enable auto-skip on ${name}`} checked={prefs.enabled}
                  disabled={saving} onChange={value => void saveSkip(id, 'enabled', value)} />
              </div>
            </article>
          );
        })}
        <div className="control-console-note">
          <Icon name="shield" size={15} />
          <span>Auto-skip works without an account. Credits and keep-watching are opt-in.</span>
        </div>
      </div>
    </section>
  );
}
