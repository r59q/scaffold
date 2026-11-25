import { WebSocket, type WebSocketServer } from "ws";

export interface BlockBuilder {
  add(id: string, render: () => string): void;
}

export function createBlockBuilder(server: WebSocketServer): BlockBuilder {
  return {
    add(id, render) {
      const message = JSON.stringify({ id, html: render() });

      for (const client of server.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    },
  };
}
