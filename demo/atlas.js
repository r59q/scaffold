import { bindBlockStream, tweenEnter } from "/scaffold/index.js";

const url = new URL("/blocks", location.href);
url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
url.search = location.search;
const connection = document.querySelector("#connection");
const counter = document.querySelector("#counter");

// The renderer retains ownership of each wrapper by ID after it moves into
// the page layout. Subsequent samples update that same element in place.
function connect() {
  const socket = new WebSocket(url);
  let count = 0;
  const seen = new Set();
  const frames = document.querySelector("#frames");
  const encoder = new TextEncoder();
  const unbind = bindBlockStream(document.querySelector("#incoming"), socket, (block) => {
    const [region] = block.dataset.blockId.split(".");
    document.getElementById(region).append(block);
    tweenEnter(block);
  });
  socket.addEventListener("open", () => {
    connection.dataset.state = "live";
    connection.textContent = "Stream live";
  });
  socket.addEventListener("message", ({ data }) => {
    const { id } = JSON.parse(data);
    const row = frames.insertRow(0);
    row.insertCell().textContent = id;
    row.insertCell().textContent = seen.has(id) ? "Update" : "Insert";
    row.insertCell().textContent = encoder.encode(data).length;
    seen.add(id);
    if (frames.rows.length > 8) frames.deleteRow(-1);
    count++;
    counter.textContent = `${count} ${count === 1 ? "block" : "blocks"}`;
  });
  socket.addEventListener("close", () => {
    unbind();
    connection.dataset.state = "closed";
    connection.textContent = "Stream offline";
    document.querySelector("#reload").hidden = false;
  });
  return socket;
}

const socket = connect();
window.addEventListener("pagehide", () => socket.close());
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
