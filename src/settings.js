// User settings, stored locally.
import AsyncStorage from '@react-native-async-storage/async-storage';

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
