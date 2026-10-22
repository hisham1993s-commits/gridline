import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, RefreshControl, BackHandler,
} from 'react-native';
import { fetchNews } from '../data/news';
import { fetchPenalties } from '../data/openf1';
import { useI18n } from '../i18n';

function fmtWhen(d) {
  if (!d) return '';
  const diff = (Date.now() - d.getTime()) / 36e5;
  if (diff < 1) return 'just now';
  if (diff < 24) return `${Math.floor(diff)}h ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function NewsScreen() {
  const { t } = useI18n();
  const [view, setView] = useState('news'); // 'news' | 'fia'
  const [items, setItems] = useState(null);
  const [fia, setFia] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const [n, p] = await Promise.all([
        fetchNews().catch(() => []),
        fetchPenalties(40).catch(() => ({ session: null, items: [] })),
      ]);
      setItems(n);
      setFia(p);
      setError('');
    } catch (e) {
      setError('Could not load. Pull to retry.');
    }
  }

  useEffect(() => { load(); }, []);

  // Android back on the FIA sub-tab returns to News.
  useEffect(() => {
    if (view !== 'fia') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setView('news'); return true; });
    return () => sub.remove();
  }, [view]);

  async function onPull() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor="#fff" />;

  return (
    <View style={styles.wrap}>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, view === 'news' && styles.tabOn]} onPress={() => setView('news')}>
          <Text style={[styles.tabText, view === 'news' && styles.tabTextOn]}>{t('f1News')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, view === 'fia' && styles.tabOn]} onPress={() => setView('fia')}>
          <Text style={[styles.tabText, view === 'fia' && styles.tabTextOn]}>{t('fiaPenalties')}</Text>
        </TouchableOpacity>
      </View>

      {view === 'news' ? (
        <ScrollView contentContainerStyle={styles.content} refreshControl={refresh}>
          <Text style={styles.sub}>{t('newsSub')}</Text>
          {!!error && <Text style={styles.error}>{error}</Text>}
          {items?.map((n, i) => (
            <TouchableOpacity key={i} style={styles.card} onPress={() => Linking.openURL(n.link)}>
              <Text style={styles.title}>{n.title}</Text>
              <Text style={styles.when}>{fmtWhen(n.date)}</Text>
            </TouchableOpacity>
          ))}
          {!items && !error && <Text style={styles.loading}>{t('loading')}</Text>}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={refresh}>
          <Text style={styles.sub}>{t('penaltiesSub')}</Text>
          {fia?.session && (
            <View style={styles.sessionTag}>
              <Text style={styles.sessionTagText}>
                {fia.session.grandPrix} · {fia.session.name}
                {fia.session.finished ? ' · FINAL' : ' · LIVE'}
              </Text>
            </View>
          )}
          {fia?.items?.length ? fia.items.map((m, i) => (
            <View key={i} style={styles.fiaRow}>
              <View style={styles.fiaBar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fiaMsg}>{m.message}</Text>
                <Text style={styles.fiaMeta}>
                  {m.lap ? `Lap ${m.lap} · ` : ''}{m.category || 'FIA'}
                </Text>
              </View>
            </View>
          )) : fia ? <Text style={styles.loading}>{t('noPenalties')}</Text>
            : <Text style={styles.loading}>{t('loading')}</Text>}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0d0d0d', paddingTop: 50 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 6 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#222' },
  tabOn: { borderBottomColor: '#E8002D' },
  tabText: { color: '#888', fontSize: 15, fontWeight: '700' },
  tabTextOn: { color: '#fff' },
  content: { padding: 16, paddingBottom: 90 },
  sub: { color: '#999', marginBottom: 14, fontSize: 13 },
  error: { color: '#ff6b6b', marginBottom: 12 },
  loading: { color: '#888', marginTop: 20 },
  card: { backgroundColor: '#161616', borderRadius: 12, padding: 14, marginBottom: 10 },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', lineHeight: 21 },
  when: { color: '#777', fontSize: 12, marginTop: 8 },
  sessionTag: { backgroundColor: '#1b1b1b', borderRadius: 8, padding: 10, marginBottom: 12 },
  sessionTagText: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  fiaRow: { flexDirection: 'row', backgroundColor: '#161616', borderRadius: 10, padding: 12, marginBottom: 8 },
  fiaBar: { width: 4, borderRadius: 2, marginRight: 10, backgroundColor: '#E8002D' },
  fiaMsg: { color: '#eee', fontSize: 13, lineHeight: 19 },
  fiaMeta: { color: '#777', fontSize: 11, marginTop: 4 },
});
