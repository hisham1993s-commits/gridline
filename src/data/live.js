// ---------------------------------------------------------------------------
// Live session field + circuit positions via OpenF1.
// Builds the track outline and every car's position in ONE coordinate frame
// (OpenF1 location x,y), so cars line up on the track. Works live with the
// paid tier; otherwise snapshots the latest completed session for testing.
// ---------------------------------------------------------------------------

import { getApiToken } from '../settings';

const BASE = 'https://api.openf1.org/v1';

async function getJSON(path, headers) {
  const res = await fetch(`${BASE}${path}`, headers ? { headers } : undefined);
  if (!res.ok) throw new Error(`OpenF1 ${path} -> ${res.status}`);
  return res.json();
}

function iso(ms) { return new Date(ms).toISOString().replace('Z', ''); }

function latestByDriver(rows, timeKey = 'date') {
  const out = {};
  for (const r of rows) {
    const n = r.driver_number;
    if (!out[n] || r[timeKey] > out[n][timeKey]) out[n] = r;
  }
  return out;
}

// Normalise [x,y] points into a centred 0..100 box (y flipped for screen).
function makeNormaliser(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX || 1, h = maxY - minY || 1;
  const scale = 90 / Math.max(w, h);
  const offX = (100 - w * scale) / 2;
  const offY = (100 - h * scale) / 2;
  return (x, y) => [offX + (x - minX) * scale, offY + (maxY - y) * scale];
}

export async function fetchLiveField(opts = {}) {
  // A sponsor token (from Settings) unlocks real-time data; otherwise the
  // free tier returns the last completed session.
  const token = await getApiToken().catch(() => '');
  const H = token ? { Authorization: `Bearer ${token}` } : undefined;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sessions = await getJSON('/sessions?session_key=latest', H);
  const s = sessions[0];
  if (!s) return null;
  const sk = s.session_key;
  await sleep(350);

  const now = Date.now();
  const start = new Date(s.date_start).getTime();
  const end = s.date_end ? new Date(s.date_end).getTime() : start + 2 * 3600000;
  const live = now >= start - 15 * 60000 && now <= end + 30 * 60000;

  // Throttle to stay under the free tier's 3 requests/second limit.
  const [posRows, intRows, drvRows0] = await Promise.all([
    getJSON(`/position?session_key=${sk}`, H).catch(() => []),
    getJSON(`/intervals?session_key=${sk}`, H).catch(() => []),
    getJSON(`/drivers?session_key=${sk}`, H).catch(() => []),
  ]);
  // Drivers can get rate-limited; retry once so names/colours always load.
  let drvRows = drvRows0;
  if (!drvRows.length) {
    await sleep(500);
    drvRows = await getJSON(`/drivers?session_key=${sk}`, H).catch(() => []);
  }
  await sleep(400);
  const rcRows = await getJSON(`/race_control?session_key=${sk}`, H).catch(() => []);

  // Snapshot time: live → now (minus delay). For the replay, pick a running
  // moment mid-session (not the end, where a red flag leaves cars stopped and
  // the outline comes out incomplete), clamped to available data.
  let T;
  if (live) {
    T = opts.cutoffMs || now;
  } else {
    const lastDate = posRows.reduce((mx, r) => (r.date > mx ? r.date : mx), '');
    const lastMs = lastDate ? new Date(lastDate).getTime() : end - 120000;
    T = Math.min(start + (end - start) * 0.55, lastMs - 60000);
  }

  const drivers = {};
  for (const d of drvRows) {
    drivers[d.driver_number] = {
      code: d.name_acronym || String(d.driver_number),
      color: `#${d.team_colour || '888888'}`,
      team: d.team_name || '',
    };
  }

  const Tiso = iso(T);
  const latestPos = latestByDriver(posRows.filter((r) => r.date <= Tiso));
  const latestInt = latestByDriver(intRows.filter((r) => r.date <= Tiso));

  // Car position snapshot (location) around T.
  await sleep(400);
  const carLoc = await getJSON(
    `/location?session_key=${sk}&date%3E=${iso(T - 2000)}&date%3C=${Tiso}`, H,
  ).catch(() => []);
  const latestLoc = latestByDriver(carLoc);

  // Reference driver (leader) full-ish lap for the outline.
  const order = Object.values(latestPos).sort((a, b) => a.position - b.position);
  const refNum = order[0]?.driver_number || drvRows[0]?.driver_number;
  await sleep(400);
  const refLoc = await getJSON(
    `/location?session_key=${sk}&driver_number=${refNum}&date%3E=${iso(T - 120000)}&date%3C=${Tiso}`, H,
  ).catch(() => []);

  // Tyres (stints) + pit stops.
  await sleep(400);
  const [stintRows, pitRows] = await Promise.all([
    getJSON(`/stints?session_key=${sk}`, H).catch(() => []),
    getJSON(`/pit?session_key=${sk}`, H).catch(() => []),
  ]);
  const tyreByDriver = {};
  const stintsByDriver = {};
  for (const st of stintRows) {
    const n = st.driver_number;
    if (!tyreByDriver[n] || (st.lap_start || 0) > (tyreByDriver[n].lap_start || 0)) tyreByDriver[n] = st;
    (stintsByDriver[n] = stintsByDriver[n] || []).push(st);
  }
  Object.values(stintsByDriver).forEach((a) => a.sort((x, y) => (x.lap_start || 0) - (y.lap_start || 0)));
  const pitCount = {};
  for (const p of pitRows) {
    if (p.date <= Tiso) pitCount[p.driver_number] = (pitCount[p.driver_number] || 0) + 1;
  }

  const outlinePts = refLoc.filter((p) => p.x != null).map((p) => [p.x, p.y]);
  const carPts = Object.values(latestLoc).filter((p) => p.x != null).map((p) => [p.x, p.y]);
  const allPts = outlinePts.concat(carPts);
  if (!allPts.length) return { live, outline: [], cars: [], field: [], flag: 'UNKNOWN' };
  const norm = makeNormaliser(allPts);

  const outline = outlinePts.map(([x, y]) => norm(x, y));

  function gapLabel(n, position) {
    if (position === 1) return 'LEADER';
    const iv = latestInt[n];
    if (!iv || iv.gap_to_leader == null) return '—';
    const g = Number(iv.gap_to_leader);
    // Lapped cars report a string like "1 LAP" — show it as-is.
    if (!Number.isFinite(g)) return String(iv.gap_to_leader);
    if (g < 60) return `+${g.toFixed(3)}`;
    const m = Math.floor(g / 60);
    return `+${m}:${String(Math.floor(g % 60)).padStart(2, '0')}`;
  }

  function intervalLabel(n, position) {
    if (position === 1) return 'INTERVAL';
    const iv = latestInt[n];
    if (!iv || iv.interval == null) return '—';
    const v = Number(iv.interval);
    if (!Number.isFinite(v)) return String(iv.interval);
    return `+${v.toFixed(3)}`;
  }

  const field = order.map((p) => {
    const n = p.driver_number;
    const info = drivers[n] || { code: String(n), color: '#888' };
    const loc = latestLoc[n];
    const xy = loc && loc.x != null ? norm(loc.x, loc.y) : null;
    const st = tyreByDriver[n];
    return {
      position: p.position, number: n, code: info.code, color: info.color, team: info.team,
      gapLabel: gapLabel(n, p.position),
      interval: intervalLabel(n, p.position),
      tyre: st?.compound || null,
      tyreAge: st?.tyre_age_at_start != null ? st.tyre_age_at_start : null,
      pits: pitCount[n] || 0,
      stints: (stintsByDriver[n] || []).map((s) => ({
        compound: s.compound, from: s.lap_start, to: s.lap_end, age: s.tyre_age_at_start,
      })),
      x: xy ? xy[0] : null, y: xy ? xy[1] : null,
    };
  });

  // Current overall track flag.
  const sortedRc = rcRows.filter((r) => r.date <= Tiso).sort((a, b) => (a.date < b.date ? 1 : -1));
  let flag = 'CLEAR';
  const lastFlag = sortedRc.find((r) => r.flag && (r.scope === 'Track' || !r.scope));
  if (lastFlag) {
    const f = lastFlag.flag.toUpperCase();
    if (f.includes('RED')) flag = 'RED';
    else if (f.includes('YELLOW')) flag = 'YELLOW';
    else if (f.includes('GREEN') || f.includes('CLEAR')) flag = 'CLEAR';
    else if (f.includes('CHEQUERED')) flag = 'FINISHED';
  }

  const messages = sortedRc.slice(0, 25).map((r) => ({
    date: new Date(r.date), lap: r.lap_number, flag: r.flag, category: r.category,
    message: r.message,
    isPenalty: /PENALTY|INVESTIGAT|DELETED|GRID|REPRIMAND|WARNING|NOTED|UNDER REVIEW|DISQUALIF/i.test(r.message || ''),
  }));

  return {
    live,
    sessionName: s.session_name || '',
    sessionType: s.session_type || '',
    grandPrix: `${s.country_name || ''} ${s.year || ''}`.trim(),
    flag,
    outline,
    field,
    cars: field.filter((d) => d.x != null),
    messages,
    penalties: messages.filter((m) => m.isPenalty),
  };
}
