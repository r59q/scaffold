import { contours } from "d3-contour";

// Sample an invented seafloor on a regular grid. D3 computes the isolines once
// at startup, so every station can reuse the same base chart over HTTP.
export function reliefMap() {
  const width = 160;
  const height = 72;
  const values = Array.from({ length: width * height }, (_, i) => {
    const x = i % width;
    const y = Math.floor(i / width);
    const ridge = x - 1.45 * y - 29 - 10 * Math.sin(y / 13);
    return 7 * Math.exp(-(ridge ** 2) / 75)
      + 2.6 * Math.sin(x / 20 + y / 16)
      + 2 * Math.cos(y / 10 - x / 17)
      + 0.9 * Math.cos(x / 8 + Math.sin(y / 7))
      + 0.35 * Math.sin(x / 3 + y / 4);
  });
  const levels = Array.from({ length: 44 }, (_, i) => -6 + i * 0.4);
  const paths = contours().size([width, height]).thresholds(levels)(values).map(({ coordinates }, i) => {
    const d = coordinates.flat().map(ring =>
      "M" + ring.map(([x, y]) => `${(x * 5).toFixed(1)},${(y * 5).toFixed(1)}`).join("L") + "Z"
    ).join("");
    return `<path d="${d}" fill="hsl(178 32% ${12 + i * 0.46}%)"
      stroke="hsl(170 30% ${24 + i * 0.62}%)" stroke-width="${i % 5 ? 0.55 : 1.15}" />`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 360">
    <rect width="800" height="360" fill="#112d30"/>${paths.join("")}</svg>`;
}

export function surveyChart(stations, selected) {
  const markers = stations.map(({ name, point: [x, y] }, i) => {
    const current = i === selected;
    return `<a href="?station=${i + 1}" aria-label="Station 0${i + 1}, ${name}" ${current ? 'aria-current="page"' : ""}>
      <title>${name}</title><g transform="translate(${x} ${y})" class="pin ${current ? "selected" : ""}">
      ${current ? '<circle class="ping" r="20"/><circle class="halo" r="13"/>' : ""}
      <circle r="7"/><circle class="center" r="2"/>
      <rect x="15" y="-12" width="67" height="24" rx="3"/>
      <text x="48" y="4" text-anchor="middle">STN 0${i + 1}</text></g></a>`;
  }).join("");
  const track = stations.map(({ point }) => point.join(",")).join(" ");
  return `<svg class="survey-map" viewBox="0 0 800 360" aria-label="Bathymetric survey chart with three linked stations">
    <defs><pattern id="grid" width="80" height="72" patternUnits="userSpaceOnUse">
      <path d="M80 0H0V72" fill="none" stroke="#b8e4db" opacity=".18"/>
      <path d="M0 5V0H5" fill="none" stroke="#dafff4" opacity=".65"/></pattern></defs>
    <image href="/relief.svg" width="800" height="360"/><rect width="800" height="360" fill="url(#grid)"/>
    <g class="chart-label"><text x="24" y="30">54° 48′ N</text><text x="24" y="332">54° 12′ N</text>
    <text x="570" y="292" transform="rotate(-17 570 292)">ABYSSAL PLAIN</text></g>
    <polyline points="${track}" fill="none" stroke="#0c302f" stroke-width="5"/>
    <polyline points="${track}" fill="none" stroke="#eec489" stroke-width="2" stroke-dasharray="6 5"/>
    ${markers}
    <g fill="#e2f0e6" transform="translate(752 50)"><text y="-12" text-anchor="middle">N</text>
      <path d="M0 -5 L6 14 L0 10Z"/><path d="M0 -5 L-6 14 L0 10Z" opacity=".45"/></g>
    <path d="M698 321v5h62v-5" fill="none" stroke="#cee3db"/>
    <text x="729" y="315" text-anchor="middle" fill="#cee3db">5 km</text></svg>`;
}

export function reading(station, tick) {
  const phase = tick % 86400 + station.point[0];
  return {
    temperature: station.temperature + 0.24 * Math.sin(phase / 6) + 0.12 * Math.sin(phase / 2.4),
    depth: station.depth + Math.round(2 * Math.cos(phase / 3)),
  };
}

export function temperatureTrace(station, tick) {
  const samples = Array.from({ length: 31 }, (_, i) => reading(station, tick - 30 + i).temperature);
  const points = samples.map((sample, i) => {
    const y = 50 - (sample - station.temperature) * 108;
    return `${4 + i * 18},${y.toFixed(1)}`;
  });
  const lastY = points.at(-1).split(",")[1];
  return `<svg class="trace" viewBox="0 0 550 100" preserveAspectRatio="none" role="img"
    aria-label="Simulated temperature over the past 60 seconds, now ${samples.at(-1).toFixed(2)} degrees Celsius">
    <defs><linearGradient id="wash" x2="0" y2="1"><stop stop-color="#469a8a" stop-opacity=".30"/>
    <stop offset="1" stop-color="#469a8a" stop-opacity=".02"/></linearGradient></defs>
    <path d="M0 10H550 M0 50H550 M0 90H550" fill="none" stroke="#c9d7d1" stroke-dasharray="3 5"/>
    <path d="M${points.join(" L")} V100 H4Z" fill="url(#wash)"/>
    <polyline points="${points.join(" ")}" fill="none" stroke="#217d70" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
    <circle cx="544" cy="${lastY}" r="4" fill="#217d70"/></svg>`;
}

export function instrumentTree(code) {
  return `<svg class="tree" viewBox="0 0 410 128" role="img"
    aria-label="Relay ${code} branches to a mooring with a CTD and current meter, and a lander with a profiler and hydrophone.">
    <g fill="none" stroke="#8cb3a8" stroke-width="1.4">
      <path d="M82 64H101V32H117 M101 64V96H117"/>
      <path d="M203 32H226V16H251 M226 32V48H251 M203 96H226V80H251 M226 96V112H251"/>
    </g>
    <rect y="49" width="82" height="30" rx="4" fill="#194f49"/>
    <text x="41" y="68" text-anchor="middle" fill="#fff">Relay ${code}</text>
    ${["Mooring", "Lander"].map((label, i) => `<rect x="117" y="${18 + 64 * i}" width="86" height="28" rx="4" fill="#e6eee8"/>
      <text x="160" y="${36 + 64 * i}" text-anchor="middle">${label}</text>`).join("")}
    ${["CTD sensor", "Current meter", "Profiler", "Hydrophone"].map((label, i) => `<circle cx="251" cy="${16 + i * 32}" r="4" fill="#2d8775"/>
      <text x="263" y="${20 + i * 32}">${label}</text>`).join("")}</svg>`;
}
