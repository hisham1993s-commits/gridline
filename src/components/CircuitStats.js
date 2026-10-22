import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

function Stat({ label, value, sub }) {
  return (
    <View style={styles.item}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

// Compact factual circuit details shown under the track map.
export default function CircuitStats({ geo }) {
  if (!geo) return null;
  const items = [];
  if (geo.length) items.push(['Length', `${(geo.length / 1000).toFixed(3)} km`]);
  if (geo.laps) items.push(['Laps', String(geo.laps)]);
  if (geo.raceDistance) items.push(['Race distance', `${geo.raceDistance.toFixed(1)} km`]);
  if (typeof geo.firstGp === 'number') items.push(['First GP', String(geo.firstGp)]);
  if (geo.drs) items.push(['DRS zones', String(geo.drs.length)]);

  return (
    <View style={styles.card}>
      <View style={styles.grid}>
        {items.map(([l, v]) => <Stat key={l} label={l} value={v} />)}
      </View>
      {geo.lapRecord && (
        <View style={styles.record}>
          <Text style={styles.label}>Lap record</Text>
          <Text style={styles.value}>{geo.lapRecord.t}</Text>
          <Text style={styles.sub}>{geo.lapRecord.who} · {geo.lapRecord.yr}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#161616', borderRadius: 14, padding: 14, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { width: '33.33%', paddingVertical: 6 },
  label: { color: '#888', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  value: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 2 },
  sub: { color: '#999', fontSize: 11, marginTop: 1 },
  record: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#242424' },
});
