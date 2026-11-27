import assert from "node:assert/strict";
import { test } from "node:test";
import { startSurvey, stationIndex } from "../survey.mjs";

test("each station streams its own notes before revising the mounted telemetry", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"] });
  const names = ["Vesper Ridge", "Orison Saddle", "Halcyon Bank"];
  for (const [i, name] of names.entries()) {
    const frames = [];
    const stop = startSurvey({ add: (id, render) => frames.push({ id, html: render() }) }, stationIndex(String(i + 1)));
    assert.equal(frames.length, 1);
    for (let elapsed = 0; elapsed < 3000; elapsed += 100) t.mock.timers.tick(100);

    const initial = new Map(frames.map(({ id, html }) => [id, html]));
    assert.equal(initial.size, frames.length);
    assert.match(initial.get("brief.name"), new RegExp(name));
    assert.match(initial.get("notes.paragraph-1"), /<p>/);
    assert.match(initial.get("notes.paragraph-2"), /<p>/);
    assert.match(initial.get("pages.links"), new RegExp(`href="\\?station=${i + 1}"[^>]*aria-current="page"`));
    assert.match(initial.get("network.tree"), /<svg/);

    t.mock.timers.tick(2000);
    const updates = new Map(frames.slice(initial.size).map(({ id, html }) => [id, html]));
    assert.deepEqual(new Set(updates.keys()), new Set(["metrics.depth", "metrics.temperature", "plot.trace", "sample.time"]));
    assert.notEqual(updates.get("plot.trace"), initial.get("plot.trace"));
    assert.notEqual(updates.get("sample.time"), initial.get("sample.time"));

    stop();
    const count = frames.length;
    t.mock.timers.tick(4000);
    assert.equal(frames.length, count);
  }
});

test("unknown stations use the first page and disconnecting cancels pending arrivals", (t) => {
  for (const value of [null, "", "0", "4", "1.5", "unknown"]) assert.equal(stationIndex(value), 0);
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const ids = [];
  const stop = startSurvey({ add: (id) => ids.push(id) }, 0);
  stop();
  t.mock.timers.tick(10000);
  assert.deepEqual(ids, ["intro.title"]);
});
