# scaffold

## Progressive loading demo

From the repository root, use Node.js 22 or newer and run:

```sh
npm --prefix backend ci
npm --prefix backend run build
npm --prefix browser ci
npm --prefix browser run build
npm --prefix demo ci
npm --prefix demo start
```

Open [http://127.0.0.1:8080/](http://127.0.0.1:8080/) in a browser. The demo
serves the built browser modules and streams HTML from the backend builder over
a WebSocket. Each visit starts a fresh sequence.

To smoke-check the demo, open the browser's Network panel, then reload the page.

1. **First block** fades in on its own. In the Network panel, the `/blocks`
   WebSocket shows an `intro` message.
2. About two seconds later, **Second block** fades in below it. The same socket
   shows a `details` message, and the page stays open without another document
   request.
3. About two seconds after that, the first heading changes to **First block
   (revised)** without another fade. The socket shows a second `intro` message,
   and the page still contains exactly two blocks with the second below the first.

### Run with Docker Compose

From the repository root, run `docker compose up --build --wait` and open
[http://127.0.0.1:8080/](http://127.0.0.1:8080/). Stop it with `docker compose down`.

### Deploy to production

Run **Deploy demo** from the default branch in GitHub Actions. It uses the same
`VAULT_ADDR`, `VAULT_USERNAME`, and `VAULT_PASSWORD` repository secrets as the
Vault test. The `kv/scaffold` secret must supply `prod.hostname`,
`prod.ssh_username`, `prod.ssh_private_key`, `prod.wg_ip`, and `prod.wg_config`.
Dotted keys and a nested `prod` object are both supported. The private key must
work non-interactively, and the `wg-quick` config must route `prod.wg_ip` over
the tunnel.

The shared Vault KV v2 secret `kv/shared` must supply `known_hosts` as a nonblank
string in OpenSSH `known_hosts` format, with one entry per line. Include a
verified host key entry for `prod.hostname`. The workflow's Vault identity
must have `read` access to `kv/data/shared`. The workflow verifies the server
key against `prod.hostname` and connects to `prod.wg_ip` through WireGuard. The
remote SSH user needs Docker access and a Compose version that supports
`up --wait`.

The workflow builds the selected revision on the server under
`$HOME/scaffold-demo` and updates `current` after the service passes its HTTP
health check. The previous release files remain available. To verify the demo,
check `docker compose ps` from `$HOME/scaffold-demo/current`, forward the
server's loopback port 8080 over SSH, and run the browser smoke check above.

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
pass it a connected `ws` WebSocket to start a page stream for one client. The
application owns the server and its lifecycle.

```ts
import { createBlockBuilder } from "@scaffold/backend";
import { WebSocketServer } from "ws";

const server = new WebSocketServer({ host: "127.0.0.1", port: 8080 });
server.on("connection", (socket) => {
  const builder = createBlockBuilder(socket);
  builder.add("intro", () => "<p>Hello</p>");

  setTimeout(() => {
    builder.add("details", () => "<p>More detail</p>");
    builder.add("intro", () => "<p>Hello again</p>");
  }, 1000);
});
```

Each call to `add` renders the block synchronously on the server and sends one
JSON text message to the open socket. Blocks arrive in call order. The first
message above is `{"id":"intro","html":"<p>Hello</p>"}`. To broadcast the same
blocks to all connected clients, pass the `WebSocketServer` to the builder and
keep its default client tracking enabled.

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
It also works on elements mounted outside the renderer and respects the
browser's reduced-motion preference.

Use `tween(window, options)` to animate other numeric values. Supply `from`,
`to`, `durationMs`, and an `update` callback. The tween interpolates linearly
unless you supply an `easing` function, and calls `onComplete` when it reaches
`to`. Call the returned function to cancel pending updates.

Use a container dedicated to the stream and connect to a server you trust to
provide HTML for the page. Call `unbind()` to stop consuming messages. The
application owns the WebSocket connection and the lifetime of the rendered DOM.
