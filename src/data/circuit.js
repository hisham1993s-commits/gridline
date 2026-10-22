// ---------------------------------------------------------------------------
// Real circuit geometry from the open f1-circuits GeoJSON dataset
// (github.com/bacinger/f1-circuits) — factual geographic coordinates.
// Returns a normalised outline (0..100 viewBox) for the TrackMap, plus DRS
// zones derived from the longest straights (the dataset has no DRS field, so
// these are the best available approximation and are labelled as such).
// Private, non-commercial use.
// ---------------------------------------------------------------------------

const URL = 'https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson';

// Curated number of DRS zones per circuit (recent seasons), keyed by the
// Jolpica/Ergast circuitId. DRS zones sit on the longest straights, so we mark
// exactly this many of them. Adjust a value here if the FIA changes a circuit.
const DRS_COUNT = {
  bahrain: 3, jeddah: 3, albert_park: 2, suzuka: 2, shanghai: 2,
  miami: 3, imola: 2, monaco: 1, villeneuve: 3, catalunya: 2,
  red_bull_ring: 3, silverstone: 2, hungaroring: 2, spa: 2, zandvoort: 2,
  monza: 2, baku: 2, marina_bay: 3, americas: 2, rodriguez: 3,
  interlagos: 2, las_vegas: 2, losail: 1, yas_marina: 2,
};

// Curated factual circuit stats: race laps and the lap record (where known).
const CIRCUIT_STATS = {
  albert_park: { laps: 58 }, shanghai: { laps: 56 }, suzuka: { laps: 53 },
  bahrain: { laps: 57, lap: { t: '1:31.447', who: 'de la Rosa', yr: 2005 } },
  jeddah: { laps: 50, lap: { t: '1:30.734', who: 'Leclerc', yr: 2024 } },
  miami: { laps: 57, lap: { t: '1:29.708', who: 'Verstappen', yr: 2023 } },
  imola: { laps: 63, lap: { t: '1:15.484', who: 'Hamilton', yr: 2020 } },
  monaco: { laps: 78, lap: { t: '1:12.909', who: 'Hamilton', yr: 2021 } },
  villeneuve: { laps: 70, lap: { t: '1:13.078', who: 'Bottas', yr: 2019 } },
  catalunya: { laps: 66, lap: { t: '1:16.330', who: 'Verstappen', yr: 2023 } },
  red_bull_ring: { laps: 71, lap: { t: '1:05.619', who: 'Sainz', yr: 2020 } },
  silverstone: { laps: 52, lap: { t: '1:27.097', who: 'Verstappen', yr: 2020 } },
  hungaroring: { laps: 70, lap: { t: '1:16.627', who: 'Hamilton', yr: 2020 } },
  spa: { laps: 44, lap: { t: '1:46.286', who: 'Bottas', yr: 2018 } },
  zandvoort: { laps: 72, lap: { t: '1:11.097', who: 'Hamilton', yr: 2021 } },
  monza: { laps: 53, lap: { t: '1:21.046', who: 'Barrichello', yr: 2004 } },
  baku: { laps: 51, lap: { t: '1:43.009', who: 'Leclerc', yr: 2019 } },
  marina_bay: { laps: 62 }, americas: { laps: 56, lap: { t: '1:36.169', who: 'Leclerc', yr: 2019 } },
  rodriguez: { laps: 71, lap: { t: '1:17.774', who: 'Bottas', yr: 2021 } },
  interlagos: { laps: 71, lap: { t: '1:10.540', who: 'Bottas', yr: 2018 } },
  las_vegas: { laps: 50, lap: { t: '1:35.490', who: 'Piastri', yr: 2024 } },
  losail: { laps: 57, lap: { t: '1:24.319', who: 'Verstappen', yr: 2024 } },
  yas_marina: { laps: 58, lap: { t: '1:25.637', who: 'Verstappen', yr: 2021 } },
};

let cache = null; // the parsed GeoJSON, fetched once

async function getData() {
  if (cache) return cache;
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`circuits ${res.status}`);
  cache = await res.json();
  return cache;
}

function centroid(coords) {
  let x = 0, y = 0;
  for (const c of coords) { x += c[0]; y += c[1]; }
  return [x / coords.length, y / coords.length];
}

// Great-circle-ish distance is overkill here; squared degrees is fine for
// picking the nearest circuit.
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

// Normalise [lon,lat] coords into a centred 0..100 box (y flipped for screen).
function normalise(coords) {
  const xs = coords.map((c) => c[0]);
  const ys = coords.map((c) => c[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX || 1, h = maxY - minY || 1;
  const scale = 90 / Math.max(w, h);
  const offX = (100 - w * scale) / 2;
  const offY = (100 - h * scale) / 2;
  return coords.map((c) => [
    offX + (c[0] - minX) * scale,
    offY + (maxY - c[1]) * scale, // flip lat → screen y
  ]);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

// Find the longest near-straight runs → DRS-zone approximation.
function detectStraights(pts, maxZones = 3) {
  const seg = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    seg.push({ i0: i - 1, i1: i, len: Math.hypot(dx, dy), ang: Math.atan2(dy, dx) });
  }
  const runs = [];
  let start = 0;
  for (let i = 1; i <= seg.length; i++) {
    const turn = i < seg.length ? angleDiff(seg[i].ang, seg[i - 1].ang) : Infinity;
    if (turn > (7 * Math.PI) / 180 || i === seg.length) {
      let len = 0;
      for (let j = start; j < i; j++) len += seg[j].len;
      runs.push({ from: seg[start].i0, to: seg[i - 1].i1, len });
      start = i;
    }
  }
  const total = runs.reduce((s, r) => s + r.len, 0) || 1;
  return runs
    .filter((r) => r.len / total > 0.06)        // ignore short straights
    .sort((a, b) => b.len - a.len)
    .slice(0, maxZones)
    .map((r) => [r.from, r.to]);
}

// Returns { points, drs, name, length } for the circuit nearest to lat/lon.
// circuitId (Jolpica) selects the curated DRS-zone count.
export async function fetchCircuitGeometry(lat, lon, circuitId) {
  if (lat == null || lon == null) return null;
  let data;
  try { data = await getData(); } catch { return null; }

  let best = null;
  for (const f of data.features || []) {
    if (f.geometry?.type !== 'LineString') continue;
    const [cx, cy] = centroid(f.geometry.coordinates);
    const d = dist2(cx, cy, lon, lat);
    // prefer nearest; tie-break toward the most recent layout
    const firstgp = f.properties?.firstgp || 0;
    if (!best || d < best.d - 1e-6 || (Math.abs(d - best.d) < 1e-4 && firstgp > best.firstgp)) {
      best = { d, firstgp, f };
    }
  }
  if (!best || best.d > 0.25) return null; // nothing close enough

  const pts = normalise(best.f.geometry.coordinates);
  const zones = DRS_COUNT[circuitId] ?? 2;
  const stats = CIRCUIT_STATS[circuitId] || {};
  const length = best.f.properties?.length || null;
  const laps = stats.laps || null;
  return {
    points: pts,
    drs: detectStraights(pts, zones),
    drsCurated: Object.prototype.hasOwnProperty.call(DRS_COUNT, circuitId),
    name: best.f.properties?.Name || '',
    length,
    firstGp: best.f.properties?.firstgp || null,
    laps,
    raceDistance: laps && length ? (laps * length) / 1000 : null, // km
    lapRecord: stats.lap || null,
  };
}
