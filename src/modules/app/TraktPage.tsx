import { readLocalStorage } from '@common/LocalStorage';
import { useEffect, useState } from "react";
import { Session } from "@common/Session";
import { Shared } from "@common/Shared";
import browser from "webextension-polyfill";
import { Icon, Notice, PageHeading, Preference, ServiceMark } from "./ui";
import { useAppState } from "./state";
import { SERVICE_IDS, SERVICE_NAMES } from "../../skip/model";

export function TraktPage() {
  const { connected, configured, options, saveOptions, saving, notify } =
    useAppState();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(!configured);
  const redirect = browser.identity.getRedirectURL();
  useEffect(() => {
    void readLocalStorage("traktApp")
      .then(({ traktApp }) => {
        setClientId(traktApp?.clientId || process.env.TRAKT_CLIENT_ID || "");
        setClientSecret(
          traktApp?.clientSecret || process.env.TRAKT_CLIENT_SECRET || "",
        );
      })
      .catch(() =>
        setError(
          "Could not load the application settings. Reload this page to try again.",
        ),
      );
  }, []);
  const save = async () => {
    setError("");
    if (!clientId.trim() || !clientSecret.trim()) {
      setError(
        "Enter both the client ID and client secret from your Trakt application.",
      );
      return;
    }
    setBusy(true);
    try {
      await browser.storage.local.remove(["auth", "scrobblingDetails"]);
      await browser.storage.sync.remove("auth");
      Session.isLoggedIn = false;
      await Shared.events.dispatch("LOGOUT_SUCCESS", null, {});
      await browser.storage.local.set({
        traktApp: {
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        },
      });
      setEditing(false);
      notify("Application saved. You can connect Trakt below.");
    } catch {
      setError("Could not save the application. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      await Session.login();
      if (!Session.isLoggedIn) throw new Error();
      notify("Trakt connected. Start watching whenever you’re ready.");
    } catch {
      setError(
        "Trakt could not connect. Try again, and check that the redirect URI matches your application.",
      );
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    setBusy(true);
    setError("");
    try {
      await Session.logout();
      if (Session.isLoggedIn) throw new Error();
      await browser.storage.local.remove("scrobblingDetails");
      notify("Trakt disconnected. Auto-skip is still available.");
    } catch {
      setError(
        "Could not disconnect from Trakt. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(redirect);
      setCopied(true);
      notify("Redirect URI copied.");
    } catch {
      setError("Could not copy. Select the redirect URI and copy it manually.");
    }
  };
  return (
    <>
      <PageHeading
        title="Trakt connection"
        description="Keep your shows and movies together, wherever you watch."
      >
        <span className={`status-badge ${connected ? "positive" : ""}`}>
          <i />
          {connected ? "Connected" : "Not connected"}
        </span>
      </PageHeading>
      <div className="trakt-layout">
        <div className="setup-steps">
          <section
            className={`panel setup-step ${configured && !editing ? "complete" : ""}`}
          >
            <span className="step-number">
              {configured && !editing ? <Icon name="check" size={17} /> : 1}
            </span>
            <div className="step-content">
              <div className="step-title">
                <h2>Create your Trakt application</h2>
                {configured && !editing && (
                  <button
                    className="text-button"
                    onClick={() => setEditing(true)}
                  >
                    Edit application
                  </button>
                )}
              </div>
              <p>
                Register BetterWatch with your Trakt account. This gives the
                extension permission to track your watching.
              </p>
              {(!configured || editing) && (
                <>
                  <a
                    href="https://trakt.tv/oauth/applications/new"
                    target="_blank"
                    rel="noreferrer"
                    className="button secondary"
                  >
                    Create application
                    <Icon name="external" size={15} />
                  </a>
                  <label className="field-label" htmlFor="redirect-uri">
                    Redirect URI
                  </label>
                  <div className="copy-field">
                    <input
                      id="redirect-uri"
                      readOnly
                      value={redirect}
                      onFocus={(event) => event.target.select()}
                    />
                    <button
                      type="button"
                      aria-label="Copy redirect URI"
                      onClick={() => void copy()}
                    >
                      <Icon name={copied ? "check" : "copy"} size={18} />
                    </button>
                  </div>
                  <p className="field-hint">
                    Use this exact URI and enable the <strong>/scrobble</strong>{" "}
                    permission in Trakt.
                  </p>
                </>
              )}
            </div>
          </section>
          <section
            className={`panel setup-step ${configured && !editing ? "complete" : ""}`}
          >
            <span className="step-number">
              {configured && !editing ? <Icon name="check" size={17} /> : 2}
            </span>
            <div className="step-content">
              <h2>Add your application details</h2>
              <p>
                {configured && !editing
                  ? "Your application details are saved in this Chrome profile."
                  : "Copy the client ID and client secret from your new Trakt application."}
              </p>
              {(!configured || editing) && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save();
                  }}
                >
                  <div className="field">
                    <label htmlFor="trakt-client-id">Client ID</label>
                    <input
                      id="trakt-client-id"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={busy}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="trakt-client-secret">Client secret</label>
                    <div className="password-field">
                      <input
                        id="trakt-client-secret"
                        type={showSecret ? "text" : "password"}
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                        disabled={busy}
                      />
                      <button
                        type="button"
                        aria-label={
                          showSecret
                            ? "Hide client secret"
                            : "Show client secret"
                        }
                        aria-pressed={showSecret}
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        <Icon name="eye" size={18} />
                      </button>
                    </div>
                  </div>
                  <p className="field-hint">
                    Saving these details disconnects any existing Trakt session.
                  </p>
                  <button
                    type="submit"
                    className="button primary"
                    disabled={busy}
                  >
                    {busy ? "Saving…" : "Save application"}
                  </button>
                </form>
              )}
            </div>
          </section>
          <section
            className={`panel setup-step ${connected ? "complete" : ""}`}
          >
            <span className="step-number">
              {connected ? <Icon name="check" size={17} /> : 3}
            </span>
            <div className="step-content">
              <h2>{connected ? "You’re connected" : "Connect your account"}</h2>
              <p>
                {connected
                  ? "BetterWatch can track movies and episodes on your enabled services."
                  : "Authorize BetterWatch in Trakt. Then you’re ready to start tracking."}
              </p>
              <button
                className={`button ${connected ? "secondary" : "primary"}`}
                disabled={busy || (!connected && !configured)}
                onClick={() => void (connected ? disconnect() : connect())}
              >
                <Icon name="trakt" size={18} />
                {busy
                  ? connected
                    ? "Disconnecting…"
                    : editing
                      ? "Saving…"
                      : "Connecting…"
                  : connected
                    ? "Disconnect Trakt"
                    : "Connect Trakt"}
              </button>
            </div>
          </section>
          {error && <Notice kind="error">{error}</Notice>}
        </div>
        <aside className="trakt-explainer">
          <span className="trakt-mark large">
            <Icon name="trakt" size={37} />
          </span>
          <h2>
            One history.
            <br />
            Every great watch.
          </h2>
          <p>
            Trakt keeps track of your movies and episodes across streaming
            services.
          </p>
          <ul className="feature-list">
            <li>
              <Icon name="check" />
              Track as you watch
            </li>
            <li>
              <Icon name="check" />
              Pause and resume naturally
            </li>
            <li>
              <Icon name="check" />
              Review and import past watches
            </li>
            <li>
              <Icon name="shield" />
              Credentials stored locally
            </li>
          </ul>
          <a
            href="https://trakt.tv"
            target="_blank"
            rel="noreferrer"
            className="text-button"
          >
            Explore Trakt
            <Icon name="external" size={15} />
          </a>
        </aside>
      </div>
      <div className="section-heading">
        <div>
          <h2>Track on your terms</h2>
          <p>Choose which services send watching activity to Trakt.</p>
        </div>
      </div>
      <section className="panel service-tracking">
        {SERVICE_IDS.map((id) => (
          <div key={id}>
            <ServiceMark service={id} small />
            <Preference
              title={`Track ${SERVICE_NAMES[id]}`}
              description={
                id === "amazon-prime"
                  ? "Prime Video title detection currently requires English."
                  : "Start, pause, and finish watching on Trakt automatically."
              }
              checked={options.services[id]?.scrobble || false}
              disabled={saving}
              onChange={(value) =>
                void saveOptions({ services: { [id]: { scrobble: value } } })
              }
            />
          </div>
        ))}
      </section>
    </>
  );
}
