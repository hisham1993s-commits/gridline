// ---------------------------------------------------------------------------
// F1 data layer
// ---------------------------------------------------------------------------
// Right now this returns SAMPLE data so the app can be tried immediately.
// When you have a real live-timing source, replace the body of
// `fetchLiveSession()` with a real network request that returns the same shape.
// Nothing else in the app needs to change.
// ---------------------------------------------------------------------------

const DRIVERS = [
  { code: 'VER', name: 'Verstappen', team: 'Red Bull', color: '#1E5BC6' },
  { code: 'NOR', name: 'Norris', team: 'McLaren', color: '#FF8000' },
  { code: 'LEC', name: 'Leclerc', team: 'Ferrari', color: '#E8002D' },
  { code: 'PIA', name: 'Piastri', team: 'McLaren', color: '#FF8000' },
  { code: 'RUS', name: 'Russell', team: 'Mercedes', color: '#27F4D2' },
  { code: 'HAM', name: 'Hamilton', team: 'Ferrari', color: '#E8002D' },
  { code: 'SAI', name: 'Sainz', team: 'Williams', color: '#64C4FF' },
  { code: 'ALO', name: 'Alonso', team: 'Aston Martin', color: '#229971' },
];

// Keeps a little live-looking state between refreshes.
let tick = 0;

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatGap(seconds) {
  if (seconds <= 0) return 'LEADER';
  if (seconds < 60) return `+${seconds.toFixed(3)}`;
  const m = Math.floor(seconds / 60);
  return `+${m}:${pad(Math.floor(seconds % 60))}`;
}

function formatLapTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3);
  return `${m}:${s.padStart(6, '0')}`;
}

// Simulated live session. Returns the whole current standings every call.
export async function fetchSampleSession() {
  tick += 1;

  const totalLaps = 57;
  const lap = Math.min(totalLaps, 1 + Math.floor(tick / 2));

  const standings = DRIVERS.map((driver, i) => {
    // A gentle wobble so positions and gaps move like a live feed.
    const jitter = Math.sin((tick + i * 7) / 3) * 0.4;
    const gap = i === 0 ? 0 : i * 1.6 + jitter + i * 0.15;
    const lapTime = 78 + i * 0.08 + Math.sin((tick + i) / 2) * 0.6;
    return {
      position: i + 1,
      ...driver,
      gap,
      gapLabel: formatGap(Math.max(0, gap)),
      lastLap: formatLapTime(lapTime),
      pit: (tick + i) % 23 === 0,
    };
  });

  return {
    sessionName: 'Race',
    grandPrix: 'Sample Grand Prix',
    lap,
    totalLaps,
    flag: lap >= totalLaps ? 'CHEQUERED' : 'GREEN',
    updatedAt: new Date(),
    standings,
  };
}

// The app calls this. It fetches REAL F1 data from OpenF1 and falls back to
// the sample session only if the network/API is unavailable.
import { fetchLiveSessionReal } from './openf1';

export async function fetchLiveSession(opts = {}) {
  try {
    const real = await fetchLiveSessionReal(opts);
    // If a session has no standings yet (e.g. between events), use the sample.
    if (real && real.standings && real.standings.length) return real;
  } catch (e) {
    // Network/API error — fall through to sample data.
  }
  const sample = await fetchSampleSession();
  sample.source = 'sample';
  return sample;
}

// A simple closed track outline (normalised 0..100 coordinates).
// Swap these points for the real circuit layout whenever you like.
export const TRACK = {
  name: 'Sample Circuit',
  // Path points tracing a loop.
  points: [
    [12, 70], [12, 40], [22, 22], [40, 18], [52, 26],
    [58, 40], [72, 42], [86, 30], [90, 50], [78, 64],
    [60, 66], [48, 58], [38, 64], [30, 80], [18, 82],
  ],
  // Where the start/finish line sits (index into points).
  startIndex: 0,
};
