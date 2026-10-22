import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useI18n } from '../i18n';

function Mini({ label, value }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

// Live current weather at the circuit.
export default function WeatherBar({ weather }) {
  const { t } = useI18n();
  if (!weather) return null;
  const raining = weather.rain > 0;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('trackWeather')}</Text>
        <View style={styles.live}>
          <View style={styles.dot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <View style={styles.main}>
        <Text style={styles.emoji}>{weather.emoji}</Text>
        <View style={styles.tempWrap}>
          <Text style={styles.temp}>{weather.temp}°</Text>
          <Text style={styles.feels}>feels {weather.feels}°</Text>
        </View>
        <View style={[styles.cond, raining ? styles.wet : styles.dry]}>
          <Text style={raining ? styles.wetText : styles.dryText}>{raining ? t('wet') : t('dry')}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Mini label={t('humidity')} value={`${weather.humidity}%`} />
        <Mini label={t('wind')} value={`${weather.wind?.toFixed(1)} m/s`} />
        <Mini label="Rain" value={`${(weather.rain ?? 0).toFixed(1)} mm`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#161616', borderRadius: 14, padding: 14, marginBottom: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { color: '#bbb', fontSize: 13, fontWeight: '600' },
  live: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a1012', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E8002D', marginRight: 5 },
  liveText: { color: '#ff5a5a', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  main: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  emoji: { fontSize: 40, marginRight: 14 },
  tempWrap: { flex: 1 },
  temp: { color: '#fff', fontSize: 34, fontWeight: '900' },
  feels: { color: '#999', fontSize: 12, marginTop: -2 },
  cond: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  dry: { backgroundColor: '#f6c344' },
  wet: { backgroundColor: '#1E6FE8' },
  dryText: { color: '#000', fontWeight: '800', fontSize: 12 },
  wetText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#242424', paddingTop: 10 },
  mini: { alignItems: 'center', flex: 1 },
  miniValue: { color: '#fff', fontSize: 16, fontWeight: '800' },
  miniLabel: { color: '#888', fontSize: 11, marginTop: 2 },
});
