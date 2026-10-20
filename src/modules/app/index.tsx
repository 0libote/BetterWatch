import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { BrowserStorage } from "@common/BrowserStorage";
import { Errors } from "@common/Errors";
import { EventDispatcher } from "@common/Events";
import { Messaging } from "@common/Messaging";
import { RequestsManager } from "@common/RequestsManager";
import { Shared } from "@common/Shared";
import { ErrorBoundary } from "@components/ErrorBoundary";
import "@services-apis";
import { App } from "./App";
import { AppStateProvider } from "./state";
import { AppTheme } from "./theme";
import "./styles.css";

Shared.pageType = "extension";
Messaging.addListeners();
Messaging.addHandlers({});
const container = document.getElementById("root");
if (!container) throw new Error("BetterWatch application root is missing.");
const root = createRoot(container);
function Startup({ failed = false }: { failed?: boolean }) {
  return (
    <div className="startup">
      <span className="startup-brand">BetterWatch</span>
      <h1>
        {failed
          ? "Couldn’t open your workspace"
          : "Getting your watch setup ready…"}
      </h1>
      <p>
        {failed
          ? "Your saved preferences are still in this browser. Reload the page to try again."
          : "Loading your preferences and connection."}
      </p>
      {failed && (
        <button className="button primary" onClick={() => location.reload()}>
          Reload BetterWatch
        </button>
      )}
    </div>
  );
}
root.render(<Startup />);
async function init() {
  try {
    await BrowserStorage.init();
    Errors.init();
    EventDispatcher.init();
    RequestsManager.init();
    Messaging.init();
    root.render(
      <HashRouter>
        <AppStateProvider>
          <AppTheme>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </AppTheme>
        </AppStateProvider>
      </HashRouter>,
    );
  } catch (error) {
    console.error("BetterWatch could not initialize.", error);
    root.render(<Startup failed />);
  }
}
void init();
