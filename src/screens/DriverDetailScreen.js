import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, BackHandler,
} from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { fetchDriverResults } from '../data/jolpica';
import { useI18n } from '../i18n';

function age(dob) {
  if (!dob) return '';
  const d = new Date(dob);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

function fmtDob(dob) {
  if (!dob) return '—';
  try {
    return new Date(dob).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return dob; }
}

// Line chart of finishing position per round (lower = better, so we invert Y).
function HistoryChart({ results }) {
  const W = 320, H = 170, padL = 26, padR = 10, padT = 14, padB = 22;
  const finished = results.filter((r) => r.position > 0);
  if (!finished.length) return <Text style={styles.noData}>No results yet.</Text>;

  const maxPos = Math.max(20, ...finished.map((r) => r.position));
  const n = results.length;
  const x = (i) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const y = (pos) => padT + ((pos - 1) / (maxPos - 1)) * (H - padT - padB);

  const pts = finished.map((r) => `${x(results.indexOf(r))},${y(r.position)}`).join(' ');

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {[1, 5, 10, 15, 20].filter((p) => p <= maxPos).map((p) => (
        <React.Fragment key={p}>
          <Line x1={padL} y1={y(p)} x2={W - padR} y2={y(p)} stroke="#222" strokeWidth={1} />
          <SvgText x={2} y={y(p) + 4} fill="#666" fontSize="9">P{p}</SvgText>
        </React.Fragment>
      ))}
      <Polyline points={pts} fill="none" stroke="#E8002D" strokeWidth={2} />
      {finished.map((r) => (
        <Circle key={r.round} cx={x(results.indexOf(r))} cy={y(r.position)} r={3} fill="#fff" />
      ))}
    </Svg>
  );
}

// Cumulative championship points across the season.
function PointsChart({ results }) {
  const W = 320, H = 150, padL = 30, padR = 10, padT = 14, padB = 20;
  let cum = 0;
  const series = results.map((r) => { cum += (r.points || 0); return { round: r.round, total: cum }; });
  const max = series.length ? series[series.length - 1].total : 0;
  if (!max) return <Text style={styles.noData}>No points yet.</Text>;
  const n = series.length;
  const x = (i) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - v / max) * (H - padT - padB);
  const line = series.map((s, i) => `${x(i)},${y(s.total)}`).join(' ');
  const gridVals = [0, Math.round(max / 2), max];
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {gridVals.map((v) => (
        <React.Fragment key={v}>
          <Line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="#222" strokeWidth={1} />
          <SvgText x={2} y={y(v) + 4} fill="#666" fontSize="9">{v}</SvgText>
        </React.Fragment>
      ))}
      <Polyline points={line} fill="none" stroke="#2ec27e" strokeWidth={2} />
    </Svg>
  );
}

export default function DriverDetailScreen({ driver, onBack }) {
  const { t } = useI18n();
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => sub.remove();
  }, [onBack]);

  useEffect(() => {
    if (!driver?.driverId) return;
    fetchDriverResults(driver.driverId)
      .then(setResults)
      .catch(() => setError('Could not load season history.'));
  }, [driver]);

  const wins = results ? results.filter((r) => r.position === 1).length : driver.wins;
  const podiums = results ? results.filter((r) => r.position >= 1 && r.position <= 3).length : null;
  const best = results && results.some((r) => r.position > 0)
    ? Math.min(...results.filter((r) => r.position > 0).map((r) => r.position)) : null;

  const initials = (driver.name || driver.code || '').split(' ').map((p) => p[0]).slice(0, 2).join('');

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.back} onPress={onBack}>
        <Text style={styles.backText}>‹ {t('points')}</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: driver.color }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.name}>{driver.name}</Text>
            <Text style={styles.team}>{driver.team}</Text>
            <Text style={styles.meta}>
              #{driver.number || '—'} · {driver.nationality || '—'}
            </Text>
          </View>
          <Text style={styles.champPos}>P{driver.position}</Text>
        </View>

        <View style={styles.statsRow}>
          <Stat label={t('pointsLabel')} value={driver.points} />
          <Stat label={t('wins')} value={wins} />
          <Stat label={t('podiums')} value={podiums ?? '—'} />
          <Stat label={t('best')} value={best ? `P${best}` : '—'} />
        </View>

        <View style={styles.infoCard}>
          <InfoRow label={t('dateOfBirth')} value={fmtDob(driver.dob)} />
          <InfoRow label={t('age')} value={driver.dob ? `${age(driver.dob)}` : '—'} />
          <InfoRow label={t('nationality')} value={driver.nationality || '—'} />
          <InfoRow label={t('carNumber')} value={driver.number ? `#${driver.number}` : '—'} />
        </View>

        <Text style={styles.chartTitle}>{t('finishByRound')}</Text>
        {error ? <Text style={styles.noData}>{error}</Text>
          : results ? <HistoryChart results={results} />
            : <Text style={styles.noData}>{t('loadingHistory')}</Text>}

        {results && results.length > 0 && (
          <>
            <Text style={styles.chartTitle}>{t('pointsByRound')}</Text>
            <PointsChart results={results} />
          </>
        )}

        {!!driver.url && (
          <TouchableOpacity style={styles.link} onPress={() => Linking.openURL(driver.url)}>
            <Text style={styles.linkText}>{t('fullProfile')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0d0d0d' },
  back: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 6 },
  backText: { color: '#E8002D', fontSize: 16, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 90 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  name: { color: '#fff', fontSize: 22, fontWeight: '800' },
  team: { color: '#ccc', fontSize: 14, marginTop: 2 },
  meta: { color: '#999', fontSize: 13, marginTop: 2 },
  champPos: { color: '#fff', fontSize: 20, fontWeight: '800' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  stat: { backgroundColor: '#161616', borderRadius: 10, paddingVertical: 12, flex: 1, marginHorizontal: 3, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#999', fontSize: 11, marginTop: 3 },
  infoCard: { backgroundColor: '#161616', borderRadius: 12, padding: 6, marginBottom: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#202020' },
  infoLabel: { color: '#999', fontSize: 14 },
  infoValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  chartTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  noData: { color: '#888', paddingVertical: 20 },
  link: { marginTop: 20, paddingVertical: 10 },
  linkText: { color: '#64C4FF', fontSize: 14, fontWeight: '600' },
});
