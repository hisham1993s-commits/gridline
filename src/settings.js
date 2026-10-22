// User settings + no-spoiler session gate, stored locally.
import AsyncStorage from '@react-native-async-storage/async-storage';

const DELAY_KEY = 'f1live.delaySec';
const SPOILER_KEY = 'f1live.noSpoiler';
const GATE_KEY = 'f1live.feedUnlockedSession'; // which session the user revealed

export async function getDelaySec() {
  const v = await AsyncStorage.getItem(DELAY_KEY);
  return v ? Number(v) : 0;
}
export async function setDelaySec(sec) {
  await AsyncStorage.setItem(DELAY_KEY, String(sec));
}

export async function getNoSpoiler() {
  return (await AsyncStorage.getItem(SPOILER_KEY)) === 'true';
}
export async function setNoSpoiler(on) {
  await AsyncStorage.setItem(SPOILER_KEY, on ? 'true' : 'false');
}

const COFFEE_KEY = 'f1live.coffeeDismissed'; // which session's coffee banner was closed
const API_TOKEN_KEY = 'f1live.openf1Token';
export async function getApiToken() { return (await AsyncStorage.getItem(API_TOKEN_KEY)) || ''; }
export async function setApiToken(v) {
  if (v) await AsyncStorage.setItem(API_TOKEN_KEY, v.trim());
  else await AsyncStorage.removeItem(API_TOKEN_KEY);
}

const TIME_MODE_KEY = 'f1live.timeMode'; // 'local' | 'track'
export async function getTimeMode() { return (await AsyncStorage.getItem(TIME_MODE_KEY)) || 'local'; }
export async function setTimeMode(m) { await AsyncStorage.setItem(TIME_MODE_KEY, m); }

const FAV_DRIVER_KEY = 'f1live.favDriver';
const FAV_TEAM_KEY = 'f1live.favTeam';

export async function getFavDriver() { return AsyncStorage.getItem(FAV_DRIVER_KEY); }
export async function setFavDriver(id) {
  if (id) await AsyncStorage.setItem(FAV_DRIVER_KEY, id);
  else await AsyncStorage.removeItem(FAV_DRIVER_KEY);
}
export async function getFavTeam() { return AsyncStorage.getItem(FAV_TEAM_KEY); }
export async function setFavTeam(id) {
  if (id) await AsyncStorage.setItem(FAV_TEAM_KEY, id);
  else await AsyncStorage.removeItem(FAV_TEAM_KEY);
}

export async function isCoffeeDismissed(sessionKey) {
  if (sessionKey == null) return false;
  return (await AsyncStorage.getItem(COFFEE_KEY)) === String(sessionKey);
}
export async function dismissCoffee(sessionKey) {
  if (sessionKey == null) return;
  await AsyncStorage.setItem(COFFEE_KEY, String(sessionKey));
}

// No-spoiler gate: once the user taps "Show live feed" for a session, it stays
// revealed for that whole session (keyed by session_key) and does not re-gate.
export async function isFeedUnlocked(sessionKey) {
  if (sessionKey == null) return false;
  return (await AsyncStorage.getItem(GATE_KEY)) === String(sessionKey);
}
export async function unlockFeed(sessionKey) {
  await AsyncStorage.setItem(GATE_KEY, String(sessionKey));
}
