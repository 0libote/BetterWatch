import { Link } from "react-router-dom";
import browser from "webextension-polyfill";
import { createScrobbleItem } from "@models/Item";
import { Shared } from "@common/Shared";
import { useAppState } from "./state";
import { Icon, PageHeading, Preference, ServiceMark } from "./ui";
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
  const { skip, connected, playing, options, saveSkip, saving, notify } =
    useAppState();
  const current =
    connected && playing?.item ? createScrobbleItem(playing.item) : null;
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
        title="Your watch setup"
        description="Less clicking between you and your next episode."
      >
        <span className={`status-badge ${active ? "positive" : ""}`}>
          <i />
          {active ? "Auto-skip is ready" : "Auto-skip is paused"}
        </span>
      </PageHeading>
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
            <span className="tiny-label">
              {current
                ? SERVICE_NAMES[current.serviceId as SkipService]
                : "Sit back. Settle in."}
            </span>
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
                    void browser.tabs.create({ url: SERVICE_URLS.netflix })
                  }
                >
                  <Icon name="play" size={16} />
                  Open Netflix
                </button>
                <Link className="button quiet" to="/auto-skip">
                  Customize auto-skip
                  <Icon name="chevron" size={15} />
                </Link>
              </div>
              <Timeline prefs={skip.netflix} />
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
      <div className="section-heading">
        <div>
          <h2>Your streaming services</h2>
          <p>One place to make each service feel a little better.</p>
        </div>
        <Link to="/auto-skip" className="text-button">
          Manage services
          <Icon name="chevron" size={16} />
        </Link>
      </div>
      <div className="service-grid">
        {SERVICE_IDS.map((id) => {
          const prefs = skip[id];
          const count =
            Number(prefs.intro) +
            Number(prefs.recap) +
            Number(prefs.credits) +
            (id === "netflix" ? Number(prefs.continueWatching) : 0);
          return (
            <section className="service-card" key={id}>
              <div className="service-card-top">
                <ServiceMark service={id} />
                <span
                  className={`status-dot ${prefs.enabled ? "active" : ""}`}
                  title={
                    prefs.enabled ? "Auto-skip enabled" : "Auto-skip paused"
                  }
                />
              </div>
              <h3>{SERVICE_NAMES[id]}</h3>
              <p>
                {prefs.enabled
                  ? `${count} skip ${count === 1 ? "preference" : "preferences"} enabled`
                  : "Auto-skip is paused"}
              </p>
              <div className="service-card-bottom">
                <span>
                  <Icon name="trakt" size={15} />
                  {connected && options.services[id]?.scrobble
                    ? "Tracking enabled"
                    : "Trakt not tracking"}
                </span>
                <Link
                  to={`/auto-skip?service=${id}`}
                  aria-label={`Customize ${SERVICE_NAMES[id]}`}
                >
                  <Icon name="chevron" size={18} />
                </Link>
              </div>
            </section>
          );
        })}
      </div>
      <div className="overview-bottom">
        <section className="panel quick-settings">
          <div className="panel-title">
            <span className="icon-tile">
              <Icon name="skip" />
            </span>
            <div>
              <h2>Netflix, your way</h2>
              <p>Your most-used skip controls, within reach.</p>
            </div>
            <Link className="text-button" to="/auto-skip">
              View all
              <Icon name="chevron" size={15} />
            </Link>
          </div>
          <Preference
            title="Skip intros"
            description="Get straight into the episode when an intro appears."
            checked={skip.netflix.intro}
            disabled={saving || !skip.netflix.enabled}
            onChange={(v) => void saveSkip("netflix", "intro", v)}
          />
          <Preference
            title="Skip recaps"
            description="Pass the recap when you’re already caught up."
            checked={skip.netflix.recap}
            disabled={saving || !skip.netflix.enabled}
            onChange={(v) => void saveSkip("netflix", "recap", v)}
          />
        </section>
        <section className="local-note">
          <span className="icon-tile">
            <Icon name="shield" />
          </span>
          <h3>Your browser. Your preferences.</h3>
          <p>
            Skip controls run on the streaming page. Trakt only starts tracking
            after you connect your account.
          </p>
          <Link className="text-button" to="/settings">
            Privacy & preferences
            <Icon name="chevron" size={15} />
          </Link>
        </section>
      </div>
    </>
  );
}
