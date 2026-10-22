// Track-local time support. Session Dates are UTC; to show "track time" we
// shift by the circuit's UTC offset (hours) for the race weekend and format
// from the UTC parts so the device zone is not applied.
// Offsets reflect the time in force during each race weekend (DST-aware,
// approximate). Keyed by Jolpica circuitId.
export const CIRCUIT_TZ = {
  albert_park: 11, shanghai: 8, suzuka: 9, bahrain: 3, jeddah: 3,
  miami: -4, imola: 2, monaco: 2, villeneuve: -4, catalunya: 2,
  red_bull_ring: 2, silverstone: 1, hungaroring: 2, spa: 2, zandvoort: 2,
  monza: 2, baku: 4, marina_bay: 8, americas: -5, rodriguez: -6,
  interlagos: -3, las_vegas: -8, losail: 3, yas_marina: 4,
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');

export function hasTrackTz(circuitId) {
  return Object.prototype.hasOwnProperty.call(CIRCUIT_TZ, circuitId);
}

// Typical session duration (minutes) for computing an approximate end time.
const SESSION_DURATION_MIN = {
  fp1: 60, fp2: 60, fp3: 60, sprint: 60, qualifying: 60, race: 120,
};

// Format a session Date in 'local' (device) or 'track' (circuit) time.
export function fmtSessionTime(date, mode, circuitId) {
  if (!date) return '';
  if (mode === 'track' && hasTrackTz(circuitId)) {
    const s = new Date(date.getTime() + CIRCUIT_TZ[circuitId] * 3600000);
    return `${DAYS[s.getUTCDay()]} ${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]}, ${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}`;
  }
  return date.toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// Just the clock time (HH:MM) for a Date in the chosen mode.
function timeOnly(date, mode, circuitId) {
  if (mode === 'track' && hasTrackTz(circuitId)) {
    const s = new Date(date.getTime() + CIRCUIT_TZ[circuitId] * 3600000);
    return `${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}`;
  }
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

// "Fri 23 Oct, 23:00 – 00:00" — start with date, end as approximate clock time.
export function fmtSessionRange(date, mode, circuitId, key) {
  if (!date) return '';
  const dur = SESSION_DURATION_MIN[key] || 60;
  const end = new Date(date.getTime() + dur * 60000);
  return `${fmtSessionTime(date, mode, circuitId)} – ${timeOnly(end, mode, circuitId)}`;
}

// Compact weekend date range, e.g. "17–19 Oct" or "31 Oct – 2 Nov" (no year).
export function weekendRange(sessions) {
  const dates = ['fp1', 'fp2', 'fp3', 'sprint', 'qualifying', 'race']
    .map((k) => sessions?.[k]).filter(Boolean);
  if (!dates.length) return '';
  const start = new Date(Math.min(...dates.map((d) => d.getTime())));
  const end = new Date(Math.max(...dates.map((d) => d.getTime())));
  const sM = MONTHS[start.getMonth()], eM = MONTHS[end.getMonth()];
  if (sM === eM) return `${start.getDate()}–${end.getDate()} ${eM}`;
  return `${start.getDate()} ${sM} – ${end.getDate()} ${eM}`;
}
