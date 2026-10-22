// ---------------------------------------------------------------------------
// Session weather forecast via Open-Meteo (https://open-meteo.com).
// Free, no API key. Given a circuit's coordinates and a session's date/time,
// returns the expected temperature and a weather emoji.
// ---------------------------------------------------------------------------

const BASE = 'https://api.open-meteo.com/v1/forecast';

// Live current weather at the circuit (Open-Meteo current conditions).
export async function fetchCurrentWeather(lat, lon) {
  if (lat == null || lon == null) return null;
  const url = `${BASE}?latitude=${lat}&longitude=${lon}`
    + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation';
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const d = await res.json();
    const c = d.current;
    if (!c) return null;
    return {
      temp: Math.round(c.temperature_2m),
      feels: Math.round(c.apparent_temperature),
      humidity: Math.round(c.relative_humidity_2m),
      wind: c.wind_speed_10m,
      rain: c.precipitation,
      emoji: codeToEmoji(c.weather_code),
      updatedAt: new Date(),
    };
  } catch { return null; }
}

// WMO weather codes -> emoji (grouped).
function codeToEmoji(code) {
  if (code == null) return '';
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️'; // 95+ thunderstorm
}

// Fetch hourly forecast for one day and return a lookup by ISO hour.
// Open-Meteo only forecasts ~16 days ahead; beyond that we return null.
export async function fetchSessionForecasts(lat, lon, sessions) {
  const dates = [...new Set(
    Object.values(sessions)
      .filter(Boolean)
      .map((d) => d.toISOString().slice(0, 10))
  )].sort();
  if (!lat || !lon || !dates.length) return {};

  const start = dates[0];
  const end = dates[dates.length - 1];
  // Guard the 16-day forecast window.
  const daysAhead = (new Date(start).getTime() - Date.now()) / 864e5;
  if (daysAhead > 15) return {};

  const url = `${BASE}?latitude=${lat}&longitude=${lon}`
    + `&hourly=temperature_2m,weather_code&start_date=${start}&end_date=${end}&timezone=UTC`;

  let data;
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    data = await res.json();
  } catch { return {}; }

  const times = data?.hourly?.time || [];
  const temps = data?.hourly?.temperature_2m || [];
  const codes = data?.hourly?.weather_code || [];
  const byHour = {};
  times.forEach((tm, i) => { byHour[tm] = { temp: temps[i], code: codes[i] }; });

  // For each session, pick the forecast at its nearest whole UTC hour.
  const out = {};
  for (const [key, d] of Object.entries(sessions)) {
    if (!d) continue;
    const hourIso = d.toISOString().slice(0, 13) + ':00';
    const f = byHour[hourIso];
    if (f) out[key] = { temp: Math.round(f.temp), emoji: codeToEmoji(f.code) };
  }
  return out;
}
