import assert from "node:assert/strict";
import { test } from "node:test";
import { tween, tweenEnter } from "@scaffold/browser";
import { JSDOM } from "jsdom";

function controlAnimationFrames(t, view) {
  const pending = new Map();
  let frameId = 0;
  t.mock.method(view, "requestAnimationFrame", (callback) => {
    pending.set(++frameId, callback);
    return frameId;
  });
  t.mock.method(view, "cancelAnimationFrame", (id) => pending.delete(id));

  function stepFrame(timestamp) {
    for (const id of Array.from(pending.keys())) {
      const callback = pending.get(id);
      pending.delete(id);
      callback?.(timestamp);
    }
  }

  return { pending, stepFrame };
}

test("tweens a numeric range with custom timing and completes at the exact endpoint", (t) => {
  const view = { requestAnimationFrame() {}, cancelAnimationFrame() {} };
  const { pending, stepFrame } = controlAnimationFrames(t, view);
  const values = [];
  tween(view, {
    from: 80,
    to: 20,
    durationMs: 400,
    easing: (progress) => progress ** 2,
    update: (value) => values.push(value),
    onComplete: () => values.push("complete"),
  });

  assert.deepEqual(values, [80]);
  stepFrame(1000);
  stepFrame(1200);
  assert.equal(values.at(-1), 65);
  stepFrame(1450);
  assert.deepEqual(values.slice(-2), [20, "complete"]);
  assert.equal(pending.size, 0);
});

test("cancels during an update and completes zero-duration tweens immediately", (t) => {
  const view = { requestAnimationFrame() {}, cancelAnimationFrame() {} };
  const { pending, stepFrame } = controlAnimationFrames(t, view);
  const completed = t.mock.fn();
  const cancel = tween(view, {
    from: 0,
    to: 10,
    durationMs: 100,
    update(value) {
      if (value > 0) cancel();
    },
    onComplete: completed,
  });

  stepFrame(1000);
  stepFrame(1050);
  assert.equal(pending.size, 0);
  assert.equal(completed.mock.callCount(), 0);

  const update = t.mock.fn();
  tween(view, { from: 0, to: 10, durationMs: 0, update, onComplete: completed });
  assert.equal(update.mock.callCount(), 1);
  assert.deepEqual(update.mock.calls[0].arguments, [10]);
  assert.equal(completed.mock.callCount(), 1);
  assert.equal(pending.size, 0);
});

test("cancels a scheduled frame between updates", (t) => {
  const view = { requestAnimationFrame() {}, cancelAnimationFrame() {} };
  const { pending, stepFrame } = controlAnimationFrames(t, view);
  const update = t.mock.fn();
  const cancel = tween(view, { from: 0, to: 10, durationMs: 100, update });

  cancel();
  stepFrame(1000);
  assert.equal(pending.size, 0);
  assert.equal(update.mock.callCount(), 1);
});

test("fades mounted blocks independently and restores their opacity", (t) => {
  const { window } = new JSDOM(`
    <style>main > div { opacity: 1; }</style>
    <main><div id="intro"><p>Hello</p></div></main>
  `, { pretendToBeVisual: true });
  t.after(() => window.close());

  const { document } = window;
  const { pending, stepFrame } = controlAnimationFrames(t, window);

  const intro = document.getElementById("intro");
  const introContent = intro.firstElementChild;
  const opacity = (element) => Number(window.getComputedStyle(element).opacity);

  assert.equal(tweenEnter(intro), undefined);
  assert.equal(opacity(intro), 0);
  stepFrame(1000);
  stepFrame(1050);
  const firstSample = opacity(intro);
  assert.ok(firstSample > 0 && firstSample < 1);

  const details = document.createElement("div");
  details.style.setProperty("opacity", "0.75", "important");
  const detailsContent = document.createElement("p");
  detailsContent.textContent = "More detail";
  details.append(detailsContent);
  intro.parentElement.append(details);
  tweenEnter(details);
  assert.equal(opacity(details), 0);
  stepFrame(1100);
  stepFrame(1150);
  const secondSample = opacity(intro);
  assert.ok(secondSample > firstSample && secondSample < 1);
  assert.ok(opacity(details) > 0 && opacity(details) < 0.75);

  stepFrame(1200);
  assert.equal(opacity(intro), 1);
  assert.equal(intro.style.getPropertyValue("opacity"), "");
  assert.ok(opacity(details) > 0 && opacity(details) < 0.75);

  stepFrame(1300);
  assert.equal(opacity(details), 0.75);
  assert.equal(details.style.getPropertyPriority("opacity"), "important");
  assert.equal(pending.size, 0);
  assert.equal(intro.firstElementChild, introContent);
  assert.equal(intro.textContent, "Hello");
  assert.equal(details.firstElementChild, detailsContent);
  assert.equal(details.textContent, "More detail");
});

test("leaves mounted blocks visible when reduced motion is preferred", (t) => {
  const { window } = new JSDOM('<div style="opacity: 0.75"></div>', { pretendToBeVisual: true });
  t.after(() => window.close());
  const { pending } = controlAnimationFrames(t, window);
  window.matchMedia = (query) => ({ matches: query === "(prefers-reduced-motion: reduce)" });

  const element = window.document.querySelector("div");
  tweenEnter(element);
  assert.equal(element.style.opacity, "0.75");
  assert.equal(pending.size, 0);
});
