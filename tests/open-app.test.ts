import { test } from "node:test";
import assert from "node:assert/strict";
let tabs: any[] = [];
let created = 0;
let updated: number[] = [];
let focused: number[] = [];
let failUpdate = false;
const fake = {
  runtime: {
    id: "test",
    getURL: (path: string) => `chrome-extension://test/${path}`,
  },
  tabs: {
    query: async () => tabs,
    create: async ({ url }: { url: string }) => {
      created++;
      return { id: 20, url };
    },
    update: async (id: number) => {
      if (failUpdate) throw new Error("Tab closed");
      updated.push(id);
      return { id };
    },
  },
  windows: {
    update: async (id: number) => {
      focused.push(id);
    },
  },
};
Object.assign(globalThis, {
  chrome: { runtime: { id: "test" } },
  browser: fake,
});
const { openApp } =
  require("../src/common/OpenApp") as typeof import("../src/common/OpenApp");
test("toolbar opens the single full-page entry point and deduplicates concurrent clicks", async () => {
  const result = await Promise.all([openApp(), openApp()]);
  assert.equal(created, 1);
  assert.equal(result[0].url, "chrome-extension://test/app.html");
  assert.equal(result[0].id, result[1].id);
});
test("toolbar focuses an existing application tab and its window", async () => {
  tabs = [
    { id: 7, windowId: 3, url: "chrome-extension://test/app.html#/history" },
  ];
  await openApp();
  assert.deepEqual(updated, [7]);
  assert.deepEqual(focused, [3]);
  assert.equal(created, 1);
});
test("toolbar opens a replacement if the previous application tab closed", async () => {
  failUpdate = true;
  await openApp();
  assert.equal(created, 2);
  failUpdate = false;
});
