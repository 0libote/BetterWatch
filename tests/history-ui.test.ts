import { test } from "bun:test";
import assert from "node:assert/strict";
Object.assign(globalThis, {
  chrome: { runtime: { id: "test" } },
  browser: {
    runtime: {
      getURL: () => "chrome-extension://test/",
      getManifest: () => ({ manifest_version: 3 }),
    },
  },
});
const { Shared } =
  require("../src/common/Shared") as typeof import("../src/common/Shared");
const { MovieItem } =
  require("../src/models/Item") as typeof import("../src/models/Item");
const { canImport, historyStatus } =
  require("../src/modules/app/history-model") as typeof import("../src/modules/app/history-model");
Shared.storage = {
  syncOptions: {
    hideSynced: false,
    minPercentageWatched: 75,
    addWithReleaseDate: false,
    addWithReleaseDateMissing: false,
  },
} as typeof Shared.storage;
function item(watchedAt: number | null | undefined = null) {
  return new MovieItem({
    serviceId: "netflix",
    title: "Movie",
    year: 2025,
    watchedAt: 1700000000,
    progress: 90,
    trakt: { id: 1, tmdbId: 1, title: "Movie", year: 2025, watchedAt },
  });
}
test("history cannot import a match until the Trakt history lookup has completed", () => {
  const value = item();
  value.trakt!.watchedAt = undefined;
  assert.equal(canImport(value), false);
  assert.equal(historyStatus(value), "Check incomplete");
});
test("history prevents imports for already synced titles, missing dates, and low progress", () => {
  assert.equal(canImport(item(1700000000)), false);
  const missingDate = item();
  delete missingDate.watchedAt;
  assert.equal(canImport(missingDate), false);
  const incomplete = item();
  incomplete.progress = 20;
  assert.equal(canImport(incomplete), false);
});
test("a confirmed unsynced match with a watched date is ready for import", () => {
  const value = item();
  assert.equal(canImport(value), true);
  assert.equal(historyStatus(value), "Ready to sync");
});
