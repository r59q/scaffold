import { instrumentTree, reading, surveyChart, temperatureTrace } from "./charts.mjs";

const stations = [
  {
    name: "Vesper Ridge", location: "54° 25′ N · 32° 42′ W", point: [218, 222],
    depth: 1840, temperature: 3.24, terrain: "Ridge crest",
    notes: ["A line of exposed basalt rises above the western basin. The mooring sits just below the crest, sheltered from the strongest flow.",
      "Instruments follow the cold boundary current as it splits around the ridge."],
  },
  {
    name: "Orison Saddle", location: "54° 32′ N · 32° 17′ W", point: [408, 158],
    depth: 2310, temperature: 2.72, terrain: "Deep passage",
    notes: ["Two steep flanks funnel deep water through a narrow saddle. The relay hangs above the passage on a single anchored line.",
      "Paired instruments measure the temperature pulses carried through the gap."],
  },
  {
    name: "Halcyon Bank", location: "54° 38′ N · 31° 51′ W", point: [603, 104],
    depth: 1270, temperature: 4.18, terrain: "Upper slope",
    notes: ["Pale sediment terraces mark the eastern end of the transect. A lander rests on the first shelf above the abyssal plain.",
      "The hydrophone listens along the slope while the profiler samples the overlying water."],
  },
];

export function stationIndex(value) {
  const index = stations.findIndex((_, i) => String(i + 1) === value);
  return index < 0 ? 0 : index;
}

function pagination(selected) {
  return stations.map(({ name }, i) => `<a href="?station=${i + 1}" aria-label="Station 0${i + 1}, ${name}"
    ${i === selected ? 'aria-current="page"' : ""}>0${i + 1}</a>`).join("");
}

const formatDepth = new Intl.NumberFormat("en-US");
const tickMs = 2000;
const tickNow = () => Math.floor(Date.now() / tickMs);

function* telemetry(station, tick) {
  const { temperature, depth } = reading(station, tick);
  yield ["metrics.depth", `<span>Sensor depth</span><strong>${formatDepth.format(depth)} <small>m</small></strong>`];
  yield ["metrics.temperature", `<span>Temperature</span><strong>${temperature.toFixed(2)} <small>°C</small></strong>`];
  yield ["plot.trace", temperatureTrace(station, tick)];
  const iso = new Date(tick * tickMs).toISOString();
  yield ["sample.time", `<time datetime="${iso}">${iso.slice(11, 19)} UTC</time>`];
}

function* initialBlocks(index) {
  const station = stations[index];
  const code = "0" + (index + 1);
  yield ["intro.title", "<h1>North Atlantic Survey</h1>"];
  yield ["intro.summary", "<p>A live field atlas of the seafloor, its instruments, and the water above.</p>"];
  yield ["pages.links", pagination(index)];
  yield ["map.chart", surveyChart(stations, index)];
  yield ["brief.code", `<span class="station-code">Station ${code} / 03</span>`];
  yield ["brief.name", `<h3>${station.name}</h3>`];
  yield ["brief.coordinates", `<p class="coordinates">${station.location}</p>`];
  for (const [i, note] of station.notes.entries()) {
    yield [`notes.paragraph-${i + 1}`, `<p>${note}</p>`];
  }
  yield ["terrain.value", station.terrain];
  yield ["network.tree", instrumentTree(code)];
  yield* telemetry(station, tickNow());
}

export function startSurvey(builder, index) {
  const blocks = initialBlocks(index);
  let timeout;
  let interval;
  function sendNext() {
    const { value, done } = blocks.next();
    if (done) {
      interval = setInterval(() => {
        for (const [id, html] of telemetry(stations[index], tickNow())) {
          builder.add(id, () => html);
        }
      }, tickMs);
      return;
    }
    const [id, html] = value;
    builder.add(id, () => html);
    timeout = setTimeout(sendNext, 110);
  }
  sendNext();
  return () => {
    clearTimeout(timeout);
    clearInterval(interval);
  };
}
