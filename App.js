import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, BackHandler } from 'react-native';
import ErrorBoundary from './src/components/ErrorBoundary';
import { I18nProvider, useI18n } from './src/i18n';
import { scheduleUpcoming, maybeNotifyWinner } from './src/notifications';
import LiveScreen from './src/screens/LiveScreen';
import StandingsScreen from './src/screens/StandingsScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import NewsScreen from './src/screens/NewsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const TABS = [
  { key: 'race', tkey: 'race', icon: '⚑', screen: LiveScreen },
  { key: 'points', tkey: 'points', icon: '▦', screen: StandingsScreen },
  { key: 'schedule', tkey: 'schedule', icon: '▤', screen: ScheduleScreen },
  { key: 'news', tkey: 'news', icon: '≣', screen: NewsScreen },
  { key: 'settings', tkey: 'settings', icon: '⚙', screen: SettingsScreen },
];

function Main() {
  const { t } = useI18n();
  const [tab, setTab] = useState('race');
  const history = useRef([]);
  const Active = TABS.find((x) => x.key === tab).screen;

  // Navigate to a tab, remembering where we came from.
  function go(next) {
    if (next !== tab) {
      history.current.push(tab);
      setTab(next);
    }
  }

  // Android back: return to the previous tab; exit only from the root.
  // (Open detail views register their own handler and are closed first.)
  useEffect(() => {
    const onBack = () => {
      if (history.current.length > 0) {
        setTab(history.current.pop());
        return true;
      }
      if (tab !== 'race') {
        setTab('race');
        return true;
      }
      return false; // on the home tab with no history → allow exit
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [tab]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.screen}>
        <Active />
      </View>
      <View style={styles.tabBar}>
        {TABS.map((x) => {
          const on = x.key === tab;
          return (
            <TouchableOpacity key={x.key} style={styles.tab} onPress={() => go(x.key)}>
              <Text style={[styles.icon, on && styles.iconOn]}>{x.icon}</Text>
              <Text style={[styles.label, on && styles.labelOn]}>{t(x.tkey)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  useEffect(() => {
    // Refresh scheduled session reminders + announce a recent winner.
    scheduleUpcoming().catch(() => {});
    maybeNotifyWinner().catch(() => {});
  }, []);

  return (
    <ErrorBoundary>
      <I18nProvider>
        <Main />
      </I18nProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d' },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: 'row', backgroundColor: '#121212',
    borderTopWidth: 1, borderTopColor: '#222',
    paddingBottom: 22, paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center' },
  icon: { color: '#666', fontSize: 18 },
  iconOn: { color: '#E8002D' },
  label: { color: '#666', fontSize: 11, marginTop: 2 },
  labelOn: { color: '#fff', fontWeight: '700' },
});
