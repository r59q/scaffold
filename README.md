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

The browser appends a block when it sees a new ID. A later message with the
same ID replaces that block's HTML in its original position.
