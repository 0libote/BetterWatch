import { useSearchParams } from "react-router-dom";
import { SERVICE_IDS, SERVICE_NAMES, SkipService } from "../../skip/model";
import { useAppState } from "./state";
import {
  Icon,
  Notice,
  PageHeading,
  Preference,
  ServiceMark,
  ServiceTabs,
  Toggle,
} from "./ui";
import { Timeline } from "./Overview";

export function SkipPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("service");
  const service: SkipService = SERVICE_IDS.includes(raw as SkipService)
    ? (raw as SkipService)
    : "netflix";
  const { skip, saveSkip, saving } = useAppState();
  const prefs = skip[service];
  return (
    <>
      <PageHeading
        title="Auto-skip"
        description="Keep the parts you love. Skip the parts you’ve seen."
      />
      <ServiceTabs
        value={service}
        onChange={(id) => setParams({ service: id })}
      />
      <section className="panel skip-workspace">
        <div className="service-detail-heading">
          <ServiceMark service={service} />
          <div>
            <h2>{SERVICE_NAMES[service]}</h2>
            <p>
              {prefs.enabled
                ? "Your preferences apply to open and future player tabs."
                : "Turn auto-skip on to use these preferences."}
            </p>
          </div>
          <div className="enable-control">
            <span>{prefs.enabled ? "Enabled" : "Paused"}</span>
            <Toggle
              label={`Enable auto-skip on ${SERVICE_NAMES[service]}`}
              checked={prefs.enabled}
              disabled={saving}
              onChange={(v) => void saveSkip(service, "enabled", v)}
            />
          </div>
        </div>
        <Timeline prefs={prefs} />
        <div className="preference-group">
          <div className="group-heading">
            <Icon name="play" size={18} />
            <h3>During the episode</h3>
          </div>
          <Preference
            title="Skip intros"
            description="Automatically press the intro’s skip button when it appears."
            checked={prefs.intro}
            disabled={saving || !prefs.enabled}
            onChange={(v) => void saveSkip(service, "intro", v)}
          />
          <Preference
            title="Skip recaps"
            description="Skip the recap of what happened in previous episodes."
            checked={prefs.recap}
            disabled={saving || !prefs.enabled}
            onChange={(v) => void saveSkip(service, "recap", v)}
          />
        </div>
        <div className="preference-group">
          <div className="group-heading">
            <Icon name="skip" size={18} />
            <h3>Keep the story going</h3>
          </div>
          <Preference
            title="Skip credits"
            description="Use the service’s next-episode button as the credits begin."
            checked={prefs.credits}
            disabled={saving || !prefs.enabled}
            onChange={(v) => void saveSkip(service, "credits", v)}
          />
          {service === "netflix" && (
            <Preference
              title="Keep watching automatically"
              description="Dismiss Netflix’s “Are you still watching?” prompt and continue playing."
              checked={prefs.continueWatching}
              disabled={saving || !prefs.enabled}
              onChange={(v) => void saveSkip(service, "continueWatching", v)}
            />
          )}
        </div>
      </section>
      <Notice>
        {service === "netflix"
          ? "BetterWatch uses Netflix’s own skip controls. It only clicks visible buttons, so availability depends on the title and player."
          : "This service shares an intro and recap button. BetterWatch recognizes known labels and leaves unfamiliar ones for you to skip manually."}
      </Notice>
      <div className="saved-note" aria-live="polite">
        <Icon name={saving ? "refresh" : "check"} size={15} />
        {saving
          ? "Saving your preference…"
          : "Changes save automatically to this browser."}
      </div>
    </>
  );
}
