import { ReactNode, useId } from "react";
import { SkipService, SERVICE_NAMES } from "../../skip/model";

export type IconName =
  | "overview"
  | "skip"
  | "history"
  | "trakt"
  | "settings"
  | "external"
  | "play"
  | "check"
  | "chevron"
  | "shield"
  | "copy"
  | "search"
  | "refresh"
  | "close"
  | "help"
  | "moon"
  | "sun"
  | "pause"
  | "eye";
const paths: Record<IconName, ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  skip: (
    <>
      <path d="m4 5 9 7-9 7V5Zm9 0 9 7-9 7V5Z" />
    </>
  ),
  history: (
    <>
      <path d="M3 11a9 9 0 1 1 2.7 7M3 4v7h7" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  trakt: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m6 13 4 4 8-10M7 7l3 3m-5 0 3 3" />
    </>
  ),
  settings: (
    <>
      <path d="m9 3-1 3-3 1v3l-2 2 2 2v3l3 1 1 3h6l1-3 3-1v-3l2-2-2-2V7l-3-1-1-3Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  external: (
    <>
      <path d="M14 3h7v7m0-7L10 14M10 4H4v16h16v-6" />
    </>
  ),
  play: <path d="m8 4 12 8-12 8V4Z" />,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M15 8V3H3v13h5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 8a8.5 8.5 0 0 0-15-2L3 9m0-6v6h6M4 16a8.5 8.5 0 0 0 15 2l2-3m0 6v-6h-6" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 1 1 4 3c-1 .4-1 1-1 2m0 3h.01" />
    </>
  ),
  moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" />
    </>
  ),
  pause: (
    <>
      <path d="M8 5v14M16 5v14" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function ServiceMark({
  service,
  small = false,
}: {
  service: SkipService;
  small?: boolean;
}) {
  return (
    <span
      className={`service-mark ${service} ${small ? "small" : ""}`}
      aria-hidden="true"
    >
      {service === "netflix" ? (
        "N"
      ) : service === "amazon-prime" ? (
        <span>
          prime
          <svg viewBox="0 0 42 12">
            <path d="M3 3c11 8 23 8 34 0m-8-1 9 1-2 7" />
          </svg>
        </span>
      ) : (
        <span className="hbo-word">
          HBO<span>max</span>
        </span>
      )}
    </span>
  );
}
export function ServiceTabs({
  value,
  onChange,
  disabled = false,
}: {
  value: SkipService | null;
  onChange: (id: SkipService) => void;
  disabled?: boolean;
}) {
  return (
    <div className="service-tabs" role="group" aria-label="Streaming service">
      {(Object.keys(SERVICE_NAMES) as SkipService[]).map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          className={value === id ? "selected" : ""}
          onClick={() => onChange(id)}
          disabled={disabled}
        >
          <ServiceMark service={id} small />
          {SERVICE_NAMES[id]}
        </button>
      ))}
    </div>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      className={`toggle ${checked ? "is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}
export function Preference({
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={`preference ${disabled ? "is-disabled" : ""}`}>
      <div>
        <label id={id}>{title}</label>
        <p>{description}</p>
      </div>
      <Toggle
        label={title}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
export function Notice({
  children,
  kind = "info",
}: {
  children: ReactNode;
  kind?: "info" | "error" | "success";
}) {
  return (
    <div
      className={`notice ${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <Icon
        name={
          kind === "error" ? "help" : kind === "success" ? "check" : "shield"
        }
        size={18}
      />
      <div>{children}</div>
    </div>
  );
}
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
