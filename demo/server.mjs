import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createBlockBuilder } from "@scaffold/backend";
import { WebSocketServer } from "ws";
import { reliefMap } from "./charts.mjs";
import { startSurvey, stationIndex } from "./survey.mjs";

const files = [
  ["/", "./index.html", "text/html; charset=utf-8"],
  ["/atlas.css", "./atlas.css", "text/css"],
  ["/atlas.js", "./atlas.js", "text/javascript"],
  ["/scaffold/index.js", "../browser/dist/index.js", "text/javascript"],
  ["/scaffold/tween.js", "../browser/dist/tween.js", "text/javascript"],
];
const assets = new Map(await Promise.all(files.map(async ([route, file, type]) => {
  const body = await readFile(new URL(file, import.meta.url));
  return [route, { body, type }];
})));
assets.set("/relief.svg", { body: reliefMap(), type: "image/svg+xml" });

const server = createServer((request, response) => {
  const asset = assets.get(request.url.split("?")[0]);
  if (request.method !== "GET" || !asset) {
    response.writeHead(404).end();
    return;
  }
  if (asset.type === "image/svg+xml") response.setHeader("Cache-Control", "public, max-age=3600");
  response.writeHead(200, { "Content-Type": asset.type }).end(asset.body);
});

const streams = new WebSocketServer({ noServer: true });
server.on("upgrade", (request, socket, head) => {
  const [path, query] = request.url.split("?");
  if (path !== "/blocks") {
    socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    return;
  }

  const index = stationIndex(new URLSearchParams(query).get("station"));
  streams.handleUpgrade(request, socket, head, (client) => {
    const stop = startSurvey(createBlockBuilder(client), index);
    client.on("error", (error) => console.error(error));
    client.once("close", stop);
  });
});

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 8080);
server.listen(port, host, () => {
  console.log(`Scaffold demo listening on ${host}:${server.address().port}`);
});
