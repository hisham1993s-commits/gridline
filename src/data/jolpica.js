// ---------------------------------------------------------------------------
// Championship standings + season schedule via the Jolpica API
// (https://api.jolpi.ca — the community-maintained successor to Ergast).
// Free, no API key. Great for driver points and the race calendar.
// ---------------------------------------------------------------------------

const BASE = 'https://api.jolpi.ca/ergast/f1';

// Team -> accent colour (Ergast has no colours; keep our own small map).
const TEAM_COLORS = {
  'Red Bull': '#1E5BC6',
  McLaren: '#FF8000',
  Ferrari: '#E8002D',
  Mercedes: '#27F4D2',
  'Aston Martin': '#229971',
  Alpine: '#0093CC',
  Williams: '#64C4FF',
  'RB F1 Team': '#6692FF',
  'Racing Bulls': '#6692FF',
  'Sauber': '#52E252',
  'Kick Sauber': '#52E252',
  Haas: '#B6BABD',
  'Audi': '#BB0A30',
};

export function teamColor(name) {
  return TEAM_COLORS[name] || '#888888';
}

async function getJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Jolpica ${path} -> ${res.status}`);
  return res.json();
}

export async function fetchStandings() {
  const data = await getJSON('/current/driverstandings/?format=json');
  const list = data?.MRData?.StandingsTable?.StandingsLists?.[0];
  const rows = list?.DriverStandings || [];
  return {
    season: list?.season || '',
    round: list?.round || '',
    drivers: rows.map((d) => {
      const team = d.Constructors?.[0]?.name || '';
      const drv = d.Driver || {};
      return {
        position: Number(d.position),
        driverId: drv.driverId || '',
        code: drv.code || drv.familyName?.slice(0, 3).toUpperCase() || '',
        name: `${drv.givenName || ''} ${drv.familyName || ''}`.trim(),
        number: drv.permanentNumber || '',
        nationality: drv.nationality || '',
        dob: drv.dateOfBirth || '',
        url: drv.url || '',
        points: Number(d.points),
        wins: Number(d.wins),
        team,
        color: teamColor(team),
      };
    }),
  };
}

function sess(obj) {
  if (!obj || !obj.date) return null;
  return new Date(`${obj.date}T${obj.time || '00:00:00Z'}`);
}

export async function fetchSchedule() {
  const data = await getJSON('/current/races/?format=json');
  const races = data?.MRData?.RaceTable?.Races || [];
  return races.map((r) => ({
    round: Number(r.round),
    name: r.raceName,
    circuit: r.Circuit?.circuitName || '',
    circuitId: r.Circuit?.circuitId || '',
    locality: r.Circuit?.Location?.locality || '',
    country: r.Circuit?.Location?.country || '',
    lat: Number(r.Circuit?.Location?.lat) || null,
    lon: Number(r.Circuit?.Location?.long) || null,
    date: r.date, // YYYY-MM-DD
    time: r.time || '', // e.g. 04:00:00Z
    sessions: {
      fp1: sess(r.FirstPractice),
      fp2: sess(r.SecondPractice),
      fp3: sess(r.ThirdPractice),
      sprint: sess(r.Sprint),
      qualifying: sess(r.Qualifying),
      race: sess({ date: r.date, time: r.time }),
    },
  }));
}

// Driver positions + points after a specific round (for movement vs last race).
export async function fetchDriverStandingsAt(round) {
  if (!round || round < 1) return {};
  try {
    const data = await getJSON(`/current/${round}/driverstandings/?format=json`);
    const rows = data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
    const map = {};
    rows.forEach((d) => {
      if (d.Driver?.driverId) map[d.Driver.driverId] = { position: Number(d.position), points: Number(d.points) };
    });
    return map;
  } catch { return {}; }
}

export async function fetchConstructorStandingsAt(round) {
  if (!round || round < 1) return {};
  try {
    const data = await getJSON(`/current/${round}/constructorstandings/?format=json`);
    const rows = data?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
    const map = {};
    rows.forEach((c) => {
      if (c.Constructor?.constructorId) map[c.Constructor.constructorId] = { position: Number(c.position), points: Number(c.points) };
    });
    return map;
  } catch { return {}; }
}

export async function fetchConstructorStandings() {
  const data = await getJSON('/current/constructorstandings/?format=json');
  const list = data?.MRData?.StandingsTable?.StandingsLists?.[0];
  const rows = list?.ConstructorStandings || [];
  return {
    season: list?.season || '',
    round: list?.round || '',
    teams: rows.map((c) => {
      const name = c.Constructor?.name || '';
      return {
        position: Number(c.position),
        constructorId: c.Constructor?.constructorId || '',
        name,
        nationality: c.Constructor?.nationality || '',
        url: c.Constructor?.url || '',
        points: Number(c.points),
        wins: Number(c.wins),
        color: teamColor(name),
      };
    }),
  };
}

// Results of the most recent completed race (podium + full field).
export async function fetchLastRace() {
  const data = await getJSON('/current/last/results/?format=json');
  const r = data?.MRData?.RaceTable?.Races?.[0];
  if (!r) return null;
  return {
    round: Number(r.round),
    name: r.raceName,
    date: r.date,
    results: (r.Results || []).map((x) => ({
      position: Number(x.position),
      code: x.Driver?.code || '',
      name: `${x.Driver?.givenName || ''} ${x.Driver?.familyName || ''}`.trim(),
      team: x.Constructor?.name || '',
      color: teamColor(x.Constructor?.name || ''),
      time: x.Time?.time || x.status || '',
      points: Number(x.points),
      pole: Number(x.grid) === 1,
      fastestLap: x.FastestLap?.rank === '1',
    })),
  };
}

function lapToSeconds(t) {
  if (!t) return null;
  const parts = String(t).split(':');
  if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
  return parseFloat(t);
}

// Qualifying result of the most recent race, with gap to pole.
export async function fetchLastQualifying() {
  const data = await getJSON('/current/last/qualifying/?format=json');
  const r = data?.MRData?.RaceTable?.Races?.[0];
  if (!r) return null;
  const rows = (r.QualifyingResults || []).map((x) => ({
    position: Number(x.position),
    code: x.Driver?.code || '',
    name: `${x.Driver?.givenName || ''} ${x.Driver?.familyName || ''}`.trim(),
    team: x.Constructor?.name || '',
    color: teamColor(x.Constructor?.name || ''),
    time: x.Q3 || x.Q2 || x.Q1 || '',
  }));
  const poleSec = lapToSeconds(rows[0]?.time);
  rows.forEach((d) => {
    const s = lapToSeconds(d.time);
    d.gap = (poleSec != null && s != null && d.position > 1) ? s - poleSec : null;
    d.gapLabel = d.gap != null ? `+${d.gap.toFixed(3)}` : '';
  });
  return { round: Number(r.round), name: r.raceName, date: r.date, results: rows };
}

// Top finishers of a specific round (for the schedule's finished races).
export async function fetchRaceResultsAt(round, top = 3) {
  if (!round) return [];
  try {
    const data = await getJSON(`/current/${round}/results/?format=json`);
    const r = data?.MRData?.RaceTable?.Races?.[0];
    const rows = r?.Results || [];
    return rows.slice(0, top).map((x) => ({
      position: Number(x.position),
      code: x.Driver?.code || '',
      name: `${x.Driver?.givenName || ''} ${x.Driver?.familyName || ''}`.trim(),
      team: x.Constructor?.name || '',
      color: teamColor(x.Constructor?.name || ''),
      time: x.Time?.time || x.status || '',
      points: Number(x.points),
    }));
  } catch { return []; }
}

// A driver's finishing position in every round this season (one API call).
export async function fetchDriverResults(driverId) {
  const data = await getJSON(`/current/drivers/${driverId}/results/?format=json&limit=40`);
  const races = data?.MRData?.RaceTable?.Races || [];
  return races.map((r) => ({
    round: Number(r.round),
    name: r.raceName,
    position: Number(r.Results?.[0]?.position),
    points: Number(r.Results?.[0]?.points),
    status: r.Results?.[0]?.status || '',
  }));
}

// First race whose date is today or later; otherwise the last race.
export function nextRace(schedule) {
  const today = new Date().toISOString().slice(0, 10);
  return schedule.find((r) => r.date >= today) || schedule[schedule.length - 1] || null;
}
