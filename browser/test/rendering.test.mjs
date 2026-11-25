import assert from "node:assert/strict";
import { test } from "node:test";
import { bindBlockStream } from "@scaffold/browser";
import { JSDOM } from "jsdom";

function createFixture(t) {
  const { window } = new JSDOM('<main id="blocks"></main>');
  t.after(() => window.close());

  const container = window.document.getElementById("blocks");
  const socket = new window.EventTarget();
  const receive = (data) => socket.dispatchEvent(new window.MessageEvent("message", { data }));

  return { container, socket, receive };
}

test("merges WebSocket frames in arrival order and animates newly mounted blocks", (t) => {
  const { container, socket, receive } = createFixture(t);
  const enter = t.mock.fn((element) => ({
    parent: element.parentElement,
    html: element.innerHTML,
  }));
  bindBlockStream(container, socket, enter);

  receive('{"id":"intro","html":"<p>Hello</p>"}');
  const intro = container.firstElementChild;
  assert.equal(intro.dataset.blockId, "intro");
  assert.equal(intro.innerHTML, "<p>Hello</p>");

  receive('{"id":"details","html":"<p>More detail</p>"}');
  const details = container.lastElementChild;
  const detailsContent = details.firstElementChild;
  assert.deepEqual(Array.from(container.children, (block) => block.dataset.blockId), ["intro", "details"]);
  assert.equal(details.innerHTML, "<p>More detail</p>");

  receive('{"id":"intro","html":"<p>Hello again</p>"}');
  assert.equal(container.children.length, 2);
  assert.equal(container.children[0], intro);
  assert.equal(container.children[1], details);
  assert.equal(container.querySelectorAll('[data-block-id="intro"]').length, 1);
  assert.equal(intro.innerHTML, "<p>Hello again</p>");
  assert.equal(details.firstElementChild, detailsContent);

  assert.equal(enter.mock.callCount(), 2);
  const [introEnter, detailsEnter] = enter.mock.calls;
  assert.equal(introEnter.arguments[0], intro);
  assert.equal(introEnter.result.parent, container);
  assert.equal(introEnter.result.html, "<p>Hello</p>");
  assert.equal(detailsEnter.arguments[0], details);
  assert.equal(detailsEnter.result.parent, container);
  assert.equal(detailsEnter.result.html, "<p>More detail</p>");
});

test("renders without an animation and detaches the listener on cleanup", (t) => {
  const { container, socket, receive } = createFixture(t);
  const unbind = bindBlockStream(container, socket);

  receive('{"id":"intro","html":"<p>Hello</p>"}');
  receive('{"id":"intro","html":"<p>Hello again</p>"}');
  assert.equal(container.firstElementChild.innerHTML, "<p>Hello again</p>");

  unbind();
  receive('{"id":"intro","html":"<p>After unbind</p>"}');
  assert.equal(container.firstElementChild.innerHTML, "<p>Hello again</p>");
});

test("ignores invalid frames and renders the next valid text frame", (t) => {
  const { container, socket, receive } = createFixture(t);
  bindBlockStream(container, socket);

  receive(new Uint8Array([1, 2, 3]));
  receive("invalid JSON");
  receive("null");
  receive('{"id":"intro","html":12}');
  assert.equal(container.children.length, 0);

  receive('{"id":"intro","html":"<p>Hello</p>"}');
  assert.equal(container.textContent, "Hello");
});
