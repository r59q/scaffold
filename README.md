# scaffold

## TypeScript backend

The backend streams server-rendered HTML blocks over WebSocket. Run these
commands from the `backend/` directory with Node.js 22 or newer.

```sh
npm ci
npm run build
npm run typecheck
npm test
```

The build emits JavaScript and TypeScript declarations to `backend/dist/`.
The test builds the package and opens a WebSocket connection on a local port.

In your server code, import `createBlockBuilder` from `@scaffold/backend` and
pass it a `ws` WebSocket server with its default client tracking enabled. The
application owns the server and its lifecycle.

```ts
import { createBlockBuilder } from "@scaffold/backend";
import { WebSocketServer } from "ws";

const server = new WebSocketServer({ host: "127.0.0.1", port: 8080 });
const builder = createBlockBuilder(server);

server.once("connection", () => {
  builder.add("intro", () => "<p>Hello</p>");

  setTimeout(() => {
    builder.add("details", () => "<p>More detail</p>");
    builder.add("intro", () => "<p>Hello again</p>");
  }, 1000);
});
```

Each call to `add` renders the block synchronously on the server and sends one
JSON text message to each currently connected client. Clients receive additions
in call order, starting from when they connect. The first message above is
`{"id":"intro","html":"<p>Hello</p>"}`.

## TypeScript browser renderer

Run these commands from the `browser/` directory with Node.js 22 or newer.

```sh
npm ci
npm run build
npm run typecheck
npm test
```

The build emits a browser ES module and TypeScript declarations to `browser/dist/`.
Import `bindBlockStream` from `@scaffold/browser` in a bundled app or from the
built `index.js` in a browser module. Pass a container and an application-owned
WebSocket before the server starts sending messages.

```ts
import { bindBlockStream, tweenEnter } from "@scaffold/browser";

const container = document.querySelector<HTMLElement>("#blocks")!;
const socket = new WebSocket("ws://127.0.0.1:8080");
const unbind = bindBlockStream(container, socket, tweenEnter);
```

Each new ID appends a `<div data-block-id="…">` containing the server-rendered
HTML. Later messages for that ID update the wrapper's contents in place. The
optional callback runs after the wrapper is inserted. `tweenEnter(element)`
fades a mounted element from transparent to its usual opacity over 200 ms.
It also works on elements mounted outside the renderer. `npm test` checks the
fade and overlapping insertions without a backend connection.

Use a container dedicated to the stream and connect to a server you trust to
provide HTML for the page. Call `unbind()` to stop consuming messages. The
application owns the WebSocket connection and the lifetime of the rendered DOM.
