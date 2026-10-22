import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { fetchSchedule, nextRace } from '../data/jolpica';
import TrackMap from '../components/TrackMap';

function fmtDate(d) {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return d; }
}

export default function TrackScreen() {
  const [race, setRace] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const schedule = await fetchSchedule();
      setRace(nextRace(schedule));
      setError('');
    } catch (e) {
      setError('Could not load track info. Pull to retry.');
    }
  }

  useEffect(() => { load(); }, []);

  async function onPull() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor="#fff" />}
    >
      <Text style={styles.h1}>Track</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}

      {race && (
        <>
          <Text style={styles.label}>NEXT RACE</Text>
          <Text style={styles.name}>{race.name}</Text>
          <Text style={styles.circuit}>{race.circuit}</Text>
          <Text style={styles.where}>{race.locality}, {race.country}</Text>
          <Text style={styles.date}>{fmtDate(race.date)}</Text>

          <TrackMap progress={0} />
          <Text style={styles.note}>
            Circuit outline is a stylised layout. Real per-circuit maps can be
            added later from a track-geometry source.
          </Text>
        </>
      )}
      {!race && !error && <Text style={styles.loading}>Loading…</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 90 },
  h1: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 16 },
  error: { color: '#ff6b6b', marginBottom: 12 },
  loading: { color: '#888', marginTop: 20 },
  label: { color: '#FF8000', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  name: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 4 },
  circuit: { color: '#ddd', fontSize: 15, marginTop: 4 },
  where: { color: '#999', fontSize: 14, marginTop: 2 },
  date: { color: '#bbb', fontSize: 14, marginTop: 8, marginBottom: 16 },
  note: { color: '#666', fontSize: 12, lineHeight: 17 },
});
