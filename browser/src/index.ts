export type EnterAnimation = (element: HTMLElement) => void;

export function bindBlockStream(
  container: HTMLElement,
  socket: Pick<WebSocket, "addEventListener" | "removeEventListener">,
  onEnter?: EnterAnimation,
): () => void {
  const blocks = new Map<string, HTMLElement>();

  function onMessage(event: MessageEvent): void {
    if (typeof event.data !== "string") return;

    let frame: unknown;
    try {
      frame = JSON.parse(event.data);
    } catch {
      return;
    }

    if (
      typeof frame !== "object" || frame === null ||
      !("id" in frame) || typeof frame.id !== "string" ||
      !("html" in frame) || typeof frame.html !== "string"
    ) return;

    const existing = blocks.get(frame.id);
    if (existing) {
      existing.innerHTML = frame.html;
      return;
    }

    const block = container.ownerDocument.createElement("div");
    block.dataset.blockId = frame.id;
    block.innerHTML = frame.html;
    blocks.set(frame.id, block);
    container.appendChild(block);
    onEnter?.(block);
  }

  socket.addEventListener("message", onMessage);
  return () => socket.removeEventListener("message", onMessage);
}
