import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";
import browser from "webextension-polyfill";
import { CorrectionDialog } from "@components/CorrectionDialog";
import { MissingWatchedDateDialog } from "@components/MissingWatchedDateDialog";
import { CustomSnackbar } from "@components/CustomSnackbar";
import { CustomDialog } from "@components/CustomDialog";
import { Overview } from "./Overview";
import { SkipPage } from "./SkipPage";
import { TraktPage } from "./TraktPage";
import { HistoryPage } from "./HistoryPage";
import { SettingsPage } from "./SettingsPage";
import { useAppState } from "./state";
import { Icon, IconName, PageHeading } from "./ui";

const links: { path: string; label: string; icon: IconName }[] = [
  { path: "/", label: "Overview", icon: "overview" },
  { path: "/auto-skip", label: "Auto-skip", icon: "skip" },
  { path: "/history", label: "Watch history", icon: "history" },
  { path: "/trakt", label: "Trakt", icon: "trakt" },
];
export function App() {
  const { pathname } = useLocation();
  const { connected, toast, saving } = useAppState();
  const version = browser.runtime.getManifest().version;
  const current =
    links.find((link) => link.path === pathname)?.label ||
    (pathname === "/settings"
      ? "Settings"
      : pathname === "/help"
        ? "Help & about"
        : "Overview");
  useEffect(() => {
    document.title = `${current} · BetterWatch`;
    window.scrollTo(0, 0);
    const main = document.getElementById("main-content");
    main?.focus({ preventScroll: true });
  }, [pathname]);
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="BetterWatch overview">
          <span className="brand-symbol">
            <Icon name="skip" size={23} />
          </span>
          <span>
            BetterWatch
            <span className="brand-subtitle">Enjoy the good part.</span>
          </span>
        </NavLink>
        <div className="nav-label">Your workspace</div>
        <nav aria-label="Main navigation">
          {links.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              aria-label={link.label}
              end={link.path === "/"}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <Icon name={link.icon} />
              <span>{link.label}</span>
              {link.path === "/trakt" && (
                <span
                  className={`nav-indicator ${connected ? "connected" : ""}`}
                />
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <nav aria-label="Support and preferences">
            <NavLink className="nav-link" aria-label="Settings" to="/settings">
              <Icon name="settings" />
              <span>Settings</span>
            </NavLink>
            <NavLink
              className="nav-link"
              aria-label="Help and about"
              to="/help"
            >
              <Icon name="help" />
              <span>Help & about</span>
            </NavLink>
          </nav>
          <div className="sidebar-footer">
            <span className="browser-symbol">C</span>
            <div>
              Made for Chrome<span>Version {version}</span>
            </div>
            <span className="footer-dot" />
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <Icon name="chevron" size={13} />
            <span>{current}</span>
          </div>
          <div className="topbar-actions">
            <span className="save-indicator" aria-live="polite">
              <Icon name={saving ? "refresh" : "check"} size={14} />
              {saving ? "Saving…" : "Preferences saved"}
            </span>
            <NavLink
              to="/trakt"
              className={`account-chip ${connected ? "connected" : ""}`}
            >
              <Icon name="trakt" size={18} />
              <span>{connected ? "Trakt connected" : "Connect Trakt"}</span>
            </NavLink>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="main-content">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/auto-skip" element={<SkipPage />} />
            <Route path="/trakt" element={<TraktPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/login" element={<Navigate to="/trakt" replace />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <footer className="page-footer">
            <span>
              BetterWatch<small>A better seat for your streaming.</small>
            </span>
            <span>
              <Icon name="shield" size={14} />
              Your controls stay in your browser.
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div
          className={`app-toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          <Icon name={toast.error ? "help" : "check"} size={18} />
          {toast.text}
        </div>
      )}
      <CorrectionDialog />
      <MissingWatchedDateDialog />
      <CustomSnackbar />
      <CustomDialog />
    </div>
  );
}
function HelpPage() {
  return (
    <>
      <PageHeading
        title="A little help"
        description="Get comfortable with your new watching setup."
      />
      <section className="panel help-section">
        <h2>Getting started</h2>
        <p>
          Open Netflix, Prime Video, or HBO Max in this Chrome profile.
          Auto-skip works without connecting Trakt. After installing or updating
          the extension, reload your streaming tabs.
        </p>
        <h2>What gets skipped?</h2>
        <p>
          Intros and recaps are enabled by default. Skipping credits and
          continuing through Netflix’s “Are you still watching?” prompt are
          optional. BetterWatch uses each service’s visible player controls.
        </p>
        <h2>Why create a Trakt application?</h2>
        <p>
          This build uses your own Trakt application. The connection page guides
          you through registration and authorization. Your client ID, client
          secret, and account tokens stay in this browser profile.
        </p>
        <h2>A title looks wrong</h2>
        <p>
          Choose “Wrong title?” on the currently watching title, or “Edit match”
          in watch history. You can provide the correct Trakt URL and save the
          match for future watches.
        </p>
        <h2>A service isn’t working</h2>
        <p>
          Streaming interfaces can change. Check that the service is enabled and
          reload its player tab. Prime Video scrobbling currently needs an
          English interface. Live playback and imports also depend on the
          service, account, and region.
        </p>
        <h2>Open source, brought together</h2>
        <p>
          BetterWatch combines Universal Trakt Scrobbler’s tracking and history
          tools with skip behavior adapted from Streaming enhanced. The combined
          extension is distributed under GPL-3.0-or-later, with the original MIT
          notices retained.
        </p>
        <div className="button-row">
          <a
            href="https://github.com/0libote/BetterWatch"
            className="button secondary"
            target="_blank"
            rel="noreferrer"
          >
            BetterWatch on GitHub
            <Icon name="external" size={15} />
          </a>
          <a
            href="https://github.com/trakt-tools/universal-trakt-scrobbler"
            className="text-button"
            target="_blank"
            rel="noreferrer"
          >
            Trakt scrobbler source
            <Icon name="external" size={14} />
          </a>
          <a
            href="https://github.com/Dreamlinerm/Netflix-Prime-Auto-Skip"
            className="text-button"
            target="_blank"
            rel="noreferrer"
          >
            Auto-skip source
            <Icon name="external" size={14} />
          </a>
        </div>
      </section>
    </>
  );
}
