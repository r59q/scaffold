import assert from "node:assert/strict";
import { test } from "node:test";
import { tweenEnter } from "@scaffold/browser";
import { JSDOM } from "jsdom";

test("fades mounted blocks independently and restores their opacity", (t) => {
  const { window } = new JSDOM(`
    <style>main > div { opacity: 1; }</style>
    <main><div id="intro"><p>Hello</p></div></main>
  `, { pretendToBeVisual: true });
  t.after(() => window.close());

  const { document } = window;
  let pendingFrames = [];
  t.mock.method(window, "requestAnimationFrame", (callback) => pendingFrames.push(callback));
  function stepFrame(timestamp) {
    const frame = pendingFrames;
    pendingFrames = [];
    for (const callback of frame) callback(timestamp);
  }

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
  assert.equal(pendingFrames.length, 0);
  assert.equal(intro.firstElementChild, introContent);
  assert.equal(intro.textContent, "Hello");
  assert.equal(details.firstElementChild, detailsContent);
  assert.equal(details.textContent, "More detail");
});
