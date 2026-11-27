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

Open [Pelagic Field Observatory](http://127.0.0.1:8080/) to explore a fictional
North Atlantic survey. The backend streams the selected station's field notes,
instruments, and simulated sensor readings to the browser renderer over
`/blocks`. The D3 bathymetric basemap is a shared HTTP asset, so its contour
geometry only needs to be downloaded once during a visit.

1. Reload a station and open **Stream live** in the masthead. The inspector
   shows the most recent block IDs, insertions or updates, and UTF-8 message
   sizes. The two field-note paragraphs arrive separately and fade into place.
2. Watch **Live telemetry** for a few seconds. The server sends new readings
   every two seconds. The temperature trace covers the last minute, and the
   same four telemetry IDs update in place. The instrument tree shows how the
   station's relay connects to the four sensors.
3. Select a numbered page or a station on the chart. Each station has a
   shareable URL and starts its own stream. Use the browser's Back button to
   return to the previous station.

Run `npm --prefix demo test` to check page selection, incremental delivery,
live updates, and stream cleanup.

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
remote SSH user needs Docker access that permits creating networks. The server
needs Docker Compose 2.24.4 or newer for the production port override.

The workflow builds the selected revision on the server under
`$HOME/scaffold-demo` and updates `current` after Compose reports the service
healthy. The previous release files remain available.

The deployment creates the shared Docker bridge network `proxy` if needed.
`compose.production.yaml` attaches the demo to it with the DNS alias
`scaffold-demo`. Compose treats `proxy` as external, so redeploys reuse the
network and it remains available to Nginx Proxy Manager after `down`.

In Nginx Proxy Manager, attach its `app` service to the same `proxy` network.
Set the Proxy Host's scheme to `http`, forward hostname to `scaffold-demo`,
and forward port to `8535` when deploying this version. Enable
**Websockets Support** for `/blocks`. Open the proxy hostname and run the
browser smoke check above.

From `$HOME/scaffold-demo/current`, run
`docker compose -f compose.yaml -f compose.production.yaml ps` to check health.
Use the same file flags with `down` to stop the deployment. The server
publishes `127.0.0.1:8535`, so you can also forward that port over SSH
and run the same browser smoke check directly.

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
