// ---------------------------------------------------------------------------
// Real F1 data via the OpenF1 API  (https://openf1.org)
// ---------------------------------------------------------------------------
// OpenF1 is an independent, community-run API. It is NOT affiliated with F1,
// the FIA, or FOM. Data is licensed CC BY-NC-SA 4.0 — free for personal,
// educational, and non-commercial fan use. Commercial use requires contacting
// the OpenF1 project.
//
// Free tier: no API key, ~3 requests/sec and 30/min, data from completed /
// recent sessions (2023+). Fully live data (during a running session) needs
// their paid Sponsor tier — set OPENF1_LIVE below once you have it.
//
// This module returns the SAME shape as the sample `fetchLiveSession()` so the
// rest of the app does not change.
// ---------------------------------------------------------------------------

const BASE = 'https://api.openf1.org/v1';

// How often the live screen should poll. Kept slow to stay under the free-tier
// 30 requests/min limit (we make ~4 requests per refresh).
export const REAL_REFRESH_MS = 15000;

// Fallback team colour if OpenF1 omits one.
const DEFAULT_COLOUR = '888888';

// Driver list is stable within a session, so cache it.
let driversCache = { sessionKey: null, map: null };

async function getJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`OpenF1 ${path} -> ${res.status}`);
  return res.json();
}

// Keep only the most recent row per driver_number (rows are time-stamped).
// cutoffIso (optional) applies the TV-sync delay: rows after it are ignored.
function latestByDriver(rows, cutoffIso) {
  const out = {};
  for (const r of rows) {
    if (cutoffIso && r.date > cutoffIso) continue;
    const n = r.driver_number;
    if (!out[n] || r.date > out[n].date) out[n] = r;
  }
  return out;
}

function formatGap(gap, position) {
  if (position === 1) return 'LEADER';
  if (gap == null) return '—';
  if (gap < 60) return `+${Number(gap).toFixed(3)}`;
  const m = Math.floor(gap / 60);
  const s = (gap % 60).toFixed(3).padStart(6, '0');
  return `+${m}:${s}`;
}

function formatLap(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3).padStart(6, '0');
  return `${m}:${s}`;
}

export async function fetchLiveSessionReal(opts = {}) {
  const cutoffIso = opts.cutoffMs ? new Date(opts.cutoffMs).toISOString() : null;
  // 1. Which session are we looking at?
  const sessions = await getJSON('/sessions?session_key=latest');
  const s = sessions[0];
  if (!s) throw new Error('No session returned');
  const sk = s.session_key;

  // 2. Drivers (cached per session).
  let drivers = driversCache.sessionKey === sk ? driversCache.map : null;
  if (!drivers) {
    const rows = await getJSON(`/drivers?session_key=${sk}`);
    drivers = {};
    for (const d of rows) {
      drivers[d.driver_number] = {
        code: d.name_acronym || String(d.driver_number),
        name: d.full_name || d.broadcast_name || '',
        team: d.team_name || '',
        color: `#${d.team_colour || DEFAULT_COLOUR}`,
      };
    }
    driversCache = { sessionKey: sk, map: drivers };
  }

  // 3. Positions, intervals, laps (in parallel).
  const [posRows, intRows, lapRows] = await Promise.all([
    getJSON(`/position?session_key=${sk}`).catch(() => []),
    getJSON(`/intervals?session_key=${sk}`).catch(() => []),
    getJSON(`/laps?session_key=${sk}`).catch(() => []),
  ]);

  const latestPos = latestByDriver(posRows, cutoffIso);
  const latestInt = latestByDriver(intRows, cutoffIso);

  // Latest lap per driver (highest lap_number).
  const latestLap = {};
  let maxLap = 0;
  for (const l of lapRows) {
    if (cutoffIso && l.date_start > cutoffIso) continue;
    const n = l.driver_number;
    if (!latestLap[n] || l.lap_number > latestLap[n].lap_number) latestLap[n] = l;
    if (l.lap_number > maxLap) maxLap = l.lap_number;
  }

  // 4. Build standings, ordered by current position.
  const standings = Object.values(latestPos)
    .map((p) => {
      const n = p.driver_number;
      const info = drivers[n] || { code: String(n), name: '', team: '', color: `#${DEFAULT_COLOUR}` };
      const iv = latestInt[n];
      const lap = latestLap[n];
      return {
        position: p.position,
        number: n,
        ...info,
        gap: iv ? iv.gap_to_leader : null,
        gapLabel: formatGap(iv ? iv.gap_to_leader : null, p.position),
        lastLap: formatLap(lap ? lap.lap_duration : null),
        pit: lap ? !!lap.is_pit_out_lap : false,
      };
    })
    .sort((a, b) => a.position - b.position);

  const finished = s.date_end && new Date(s.date_end).getTime() < Date.now();

  return {
    sessionKey: sk,
    sessionName: s.session_name || s.session_type || 'Session',
    sessionType: s.session_type || '',
    grandPrix: `${s.country_name || s.location || 'Grand Prix'} ${s.year || ''}`.trim(),
    lap: maxLap,
    totalLaps: maxLap || 1,
    flag: finished ? 'CHEQUERED' : 'GREEN',
    live: isSessionLive(s),
    updatedAt: new Date(),
    standings,
    source: 'OpenF1',
  };
}

// A session counts as "live" from 15 min before start to 30 min after end.
export function isSessionLive(s) {
  if (!s || !s.date_start) return false;
  const now = Date.now();
  const start = new Date(s.date_start).getTime() - 15 * 60000;
  const end = s.date_end ? new Date(s.date_end).getTime() + 30 * 60000 : start + 3 * 3600000;
  return now >= start && now <= end;
}

export async function fetchSessionMeta() {
  const sessions = await getJSON('/sessions?session_key=latest');
  const s = sessions[0] || null;
  return s ? { ...s, live: isSessionLive(s) } : null;
}

// Latest weather reading for the current session.
export async function fetchWeather() {
  const s = await fetchSessionMeta();
  if (!s) return null;
  const rows = await getJSON(`/weather?session_key=${s.session_key}`);
  const w = rows[rows.length - 1];
  if (!w) return null;
  return {
    airTemp: w.air_temperature,
    trackTemp: w.track_temperature,
    humidity: w.humidity,
    rainfall: w.rainfall,
    windSpeed: w.wind_speed,
    windDirection: w.wind_direction,
    updatedAt: new Date(),
  };
}

// Latest car speed (km/h) per driver, from a short recent window so the
// payload stays small. Live-session feature. cutoffMs applies the TV delay.
export async function fetchCarSpeeds(cutoffMs = 0) {
  const s = await fetchSessionMeta();
  if (!s) return {};
  const end = cutoffMs || Date.now();
  const startIso = new Date(end - 5000).toISOString();
  const endIso = new Date(end).toISOString();
  let rows;
  try {
    rows = await getJSON(`/car_data?session_key=${s.session_key}&date>=${startIso}&date<=${endIso}`);
  } catch { return {}; }
  const speeds = {};
  for (const r of rows) {
    const n = r.driver_number;
    if (!speeds[n] || r.date > speeds[n].date) speeds[n] = { date: r.date, speed: r.speed };
  }
  const out = {};
  for (const [n, v] of Object.entries(speeds)) out[n] = v.speed;
  return out;
}

// Recent team-radio clips (driver + audio URL), newest first. Live feature.
export async function fetchTeamRadio(limit = 12, cutoffMs = 0) {
  const s = await fetchSessionMeta();
  if (!s) return [];
  const cutoffIso = cutoffMs ? new Date(cutoffMs).toISOString() : null;
  let rows;
  try {
    rows = await getJSON(`/team_radio?session_key=${s.session_key}`);
  } catch { return []; }
  return rows
    .filter((r) => r.recording_url && (!cutoffIso || r.date <= cutoffIso))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit)
    .map((r) => ({ driver: r.driver_number, date: new Date(r.date), url: r.recording_url }));
}

// FIA decisions & penalties for the latest session (before/during/after).
// Filters race-control messages to penalties, investigations and decisions.
export async function fetchPenalties(limit = 40) {
  const s = await fetchSessionMeta();
  if (!s) return { session: null, items: [] };
  const rows = await getJSON(`/race_control?session_key=${s.session_key}`);
  const items = rows
    .filter((r) => r.message && /PENALTY|INVESTIGAT|REPRIMAND|WARNING|DELETED|UNDER REVIEW|NOTED|GRID|DISQUALIF|STOP\/GO|DRIVE.THROUGH|TIME PENALTY/i.test(r.message))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit)
    .map((r) => ({
      date: new Date(r.date),
      lap: r.lap_number,
      driver: r.driver_number,
      category: r.category,
      message: r.message,
    }));
  return {
    session: {
      name: s.session_name,
      type: s.session_type,
      grandPrix: `${s.country_name || ''} ${s.year || ''}`.trim(),
      finished: s.date_end && new Date(s.date_end).getTime() < Date.now(),
    },
    items,
  };
}

// Recent race-control messages (flags, penalties, incidents), newest first.
export async function fetchRaceControl(limit = 15, cutoffMs = 0) {
  const s = await fetchSessionMeta();
  if (!s) return { messages: [], trackStatus: 'UNKNOWN' };
  const cutoffIso = cutoffMs ? new Date(cutoffMs).toISOString() : null;
  const rows = await getJSON(`/race_control?session_key=${s.session_key}`);
  const sorted = rows
    .filter((r) => r.message && (!cutoffIso || r.date <= cutoffIso))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  // Track status from the most recent track-scope flag.
  let trackStatus = 'CLEAR';
  const lastFlag = sorted.find((r) => r.flag);
  if (lastFlag) {
    const f = lastFlag.flag.toUpperCase();
    if (f.includes('RED')) trackStatus = 'RED';
    else if (f.includes('YELLOW')) trackStatus = 'YELLOW';
    else if (f.includes('GREEN') || f.includes('CLEAR')) trackStatus = 'CLEAR';
    else if (f.includes('CHEQUERED')) trackStatus = 'FINISHED';
  }

  return {
    trackStatus,
    messages: sorted.slice(0, limit).map((r) => ({
      date: new Date(r.date),
      lap: r.lap_number,
      category: r.category,
      flag: r.flag,
      message: r.message,
      isPenalty: /PENALTY|INVESTIGAT|TIME|GRID/i.test(r.message),
    })),
  };
}
