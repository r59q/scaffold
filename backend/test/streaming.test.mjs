import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { createBlockBuilder } from "@scaffold/backend";
import { WebSocket, WebSocketServer } from "ws";

test("streams each new or revised block as one ordered text message", { timeout: 5000 }, async (t) => {
  const server = await startServer(t);
  const builder = createBlockBuilder(server);

  const client = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
  let messageCount = 0;
  client.on("message", () => {
    messageCount += 1;
  });
  await once(client, "open");

  const greeting = "Hello";
  let nextMessage = once(client, "message");
  builder.add("intro", () => `<p>${greeting}</p>`);
  await assertMessage(nextMessage, { id: "intro", html: "<p>Hello</p>" });

  const count = 2;
  nextMessage = once(client, "message");
  builder.add("details", () => `<p>Count: ${count}</p>`);
  await assertMessage(nextMessage, { id: "details", html: "<p>Count: 2</p>" });

  nextMessage = once(client, "message");
  builder.add("intro", () => `<p>${greeting} again</p>`);
  await assertMessage(nextMessage, { id: "intro", html: "<p>Hello again</p>" });

  const closed = once(client, "close");
  client.close();
  await closed;
  assert.equal(messageCount, 3);
});

test("keeps builders scoped to their own WebSocket when pages connect concurrently", { timeout: 5000 }, async (t) => {
  const server = await startServer(t);
  const builders = [];
  server.on("connection", (socket) => builders.push(createBlockBuilder(socket)));

  async function connect() {
    const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
    const messages = [];
    const done = new Promise((resolve) => {
      socket.on("message", (data) => {
        const frame = JSON.parse(data.toString("utf8"));
        if (frame.id === "done") resolve(messages);
        else messages.push(frame);
      });
    });
    await once(socket, "open");
    return { done };
  }

  const first = await connect();
  builders[0].add("intro", () => "<p>First page</p>");

  const second = await connect();
  builders[1].add("intro", () => "<p>Second page</p>");
  builders[0].add("intro", () => "<p>First page revised</p>");
  createBlockBuilder(server).add("done", () => "");

  assert.deepEqual(await Promise.all([first.done, second.done]), [
    [
      { id: "intro", html: "<p>First page</p>" },
      { id: "intro", html: "<p>First page revised</p>" },
    ],
    [{ id: "intro", html: "<p>Second page</p>" }],
  ]);
});

async function startServer(t) {
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  t.after(async () => {
    for (const socket of server.clients) {
      socket.terminate();
    }
    const closed = once(server, "close");
    server.close();
    await closed;
  });
  await once(server, "listening");
  return server;
}

async function assertMessage(message, expected) {
  const [data, isBinary] = await message;
  assert.equal(isBinary, false);
  assert.deepEqual(JSON.parse(data.toString("utf8")), expected);
}
