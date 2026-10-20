import type { ScrobbleItem } from "@models/Item";

export function canImport(item: ScrobbleItem): boolean {
  // An undefined watchedAt means the Trakt history check did not complete.
  return (
    item.isSelectable() &&
    item.trakt?.watchedAt === null &&
    !item.isMissingWatchedDate()
  );
}
export function historyStatus(item: ScrobbleItem): string {
  if (item.isLoading) return "Matching…";
  if (!item.trakt) return "Needs a match";
  if (item.trakt.watchedAt) return "On Trakt";
  if (item.trakt.watchedAt === undefined) return "Check incomplete";
  if (item.isMissingWatchedDate()) return "Needs a date";
  if (!item.isSelectable()) return "Below watch threshold";
  return "Ready to sync";
}
export function formatWatchedDate(timestamp?: number | null): string {
  if (!timestamp) return "Date missing";
  const date = new Date(timestamp * 1000);
  return Number.isNaN(date.getTime())
    ? "Date missing"
    : new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date);
}
