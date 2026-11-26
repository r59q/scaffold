import { WebSocket, type WebSocketServer } from "ws";

export interface BlockBuilder {
  add(id: string, render: () => string): void;
}

export function createBlockBuilder(target: WebSocketServer | WebSocket): BlockBuilder {
  return {
    add(id, render) {
      const message = JSON.stringify({ id, html: render() });
      const clients = "send" in target ? [target] : target.clients;

      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    },
  };
}
