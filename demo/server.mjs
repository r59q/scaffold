import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createBlockBuilder } from "@scaffold/backend";
import { WebSocketServer } from "ws";

const files = [
  ["/", "./index.html", "text/html; charset=utf-8"],
  ["/scaffold/index.js", "../browser/dist/index.js", "text/javascript"],
  ["/scaffold/tween.js", "../browser/dist/tween.js", "text/javascript"],
];
const assets = new Map(await Promise.all(files.map(async ([route, file, type]) => {
  const body = await readFile(new URL(file, import.meta.url));
  return [route, { body, type }];
})));

const server = createServer((request, response) => {
  const asset = assets.get(request.url);
  if (request.method !== "GET" || !asset) {
    response.writeHead(404).end();
    return;
  }

  response.writeHead(200, { "Content-Type": asset.type }).end(asset.body);
});

const interval = 2000;
const streams = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  if (request.url !== "/blocks") {
    socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    return;
  }

  streams.handleUpgrade(request, socket, head, (client) => {
    const builder = createBlockBuilder(client);

    builder.add("intro", () => `
      <h2>First block</h2>
      <p>This HTML arrived from the server. The second block is still pending.</p>
    `);

    const addDetails = setTimeout(() => {
      builder.add("details", () => `
        <h2>Second block</h2>
        <p>This block joined the page over the same WebSocket.</p>
      `);
    }, interval);

    const reviseIntro = setTimeout(() => {
      builder.add("intro", () => `
        <h2>First block (revised)</h2>
        <p>The server updated this block in place.</p>
      `);
    }, 2 * interval);

    client.on("error", (error) => console.error(error));
    client.once("close", () => {
      clearTimeout(addDetails);
      clearTimeout(reviseIntro);
    });
  });
});

server.listen(8080, "127.0.0.1", () => {
  console.log("Scaffold demo running at http://127.0.0.1:8080/");
});
