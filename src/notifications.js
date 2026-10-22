// ---------------------------------------------------------------------------
// Local session reminders. We schedule a notification a few minutes before
// each upcoming session (from the known schedule) — no server needed, works
// offline. The user can turn this on/off in Settings.
// ---------------------------------------------------------------------------
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchSchedule, nextRace, fetchLastRace } from './data/jolpica';

const ENABLED_KEY = 'f1live.notify';
const WINNER_KEY = 'f1live.winnerNotified'; // last round we announced
const LEAD_MIN = 10; // notify this many minutes before a session starts

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function getNotifyEnabled() {
  return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
}

export async function setNotifyEnabled(on) {
  await AsyncStorage.setItem(ENABLED_KEY, on ? 'true' : 'false');
  if (on) await scheduleUpcoming();
  else await Notifications.cancelAllScheduledNotificationsAsync();
}

async function ensurePermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

// Schedule reminders for the next race's sessions (and the race itself).
export async function scheduleUpcoming() {
  if (!(await getNotifyEnabled())) return;
  if (!(await ensurePermission())) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('sessions', {
      name: 'Session reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  let schedule;
  try { schedule = await fetchSchedule(); } catch { return; }
  const r = nextRace(schedule);
  if (!r) return;

  const items = [
    ['Practice 1', r.sessions.fp1],
    ['Practice 2', r.sessions.fp2],
    ['Practice 3', r.sessions.fp3],
    ['Sprint', r.sessions.sprint],
    ['Qualifying', r.sessions.qualifying],
    ['Race', r.sessions.race],
  ].filter(([, d]) => d);

  const now = Date.now();
  for (const [name, when] of items) {
    const fireAt = when.getTime() - LEAD_MIN * 60000;
    if (fireAt <= now) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${r.name} — ${name}`,
        body: `${name} starts in ${LEAD_MIN} minutes.`,
        ...(Platform.OS === 'android' ? { channelId: 'sessions' } : {}),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(fireAt) },
    });
  }
}

// Announce the winner once a race has finished. Called on app launch: if the
// most recent race ended within the last 2 days and we haven't announced it,
// fire a local notification with the winner. (A local notification can't know
// the result in advance, so we deliver it the first time the app opens after
// the race — reliable without a server.)
export async function maybeNotifyWinner() {
  if (!(await getNotifyEnabled())) return;
  let last;
  try { last = await fetchLastRace(); } catch { return; }
  if (!last || !last.results?.length) return;

  const raceDate = new Date(`${last.date}T00:00:00Z`).getTime();
  const twoDays = 2 * 864e5;
  if (Date.now() - raceDate > twoDays) return; // too old, skip

  const already = await AsyncStorage.getItem(WINNER_KEY);
  if (already === String(last.round)) return; // already announced

  const winner = last.results.find((r) => r.position === 1);
  if (!winner) return;

  if (!(await ensurePermission())) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('results', {
      name: 'Race results',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🏁 ${last.name}`,
      body: `${winner.name} (${winner.team}) wins the race.`,
      ...(Platform.OS === 'android' ? { channelId: 'results' } : {}),
    },
    trigger: null, // deliver now
  });
  await AsyncStorage.setItem(WINNER_KEY, String(last.round));
}
