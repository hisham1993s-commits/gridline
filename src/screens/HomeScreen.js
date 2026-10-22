import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import { AppState } from 'react-native';
import { fetchSchedule, nextRace, fetchLastRace, fetchLastQualifying } from '../data/jolpica';
import { fetchSessionForecasts, fetchCurrentWeather } from '../data/forecast';
import { fetchCircuitGeometry } from '../data/circuit';
import { getTimeMode, setTimeMode } from '../settings';
import { fmtSessionRange, weekendRange, hasTrackTz } from '../trackTime';
import { useI18n } from '../i18n';
import { countryFlag } from '../flags';
import { medal } from '../medals';
import { rf } from '../responsive';
import TrackMap from '../components/TrackMap';
import CircuitStats from '../components/CircuitStats';
import CheckeredLine from '../components/CheckeredLine';
import WeatherBar from '../components/WeatherBar';

const ROW_H = 35; // approx height of one result row, for the 10-row scroll window

function fmtSession(d) {
  if (!d) return null;
  return d.toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

const SESSION_KEYS = [
  ['fp1', 'practice1'], ['fp2', 'practice2'], ['fp3', 'practice3'],
  ['sprint', 'sprint'], ['qualifying', 'qualifying'], ['race', 'raceSession'],
];

// Soonest session that is still in the future.
function nextSessionOf(sessions, now) {
  let best = null;
  for (const [key, labelKey] of SESSION_KEYS) {
    const d = sessions?.[key];
    if (d && d.getTime() > now && (!best || d < best.date)) best = { key, labelKey, date: d };
  }
  return best;
}

function fmtCountdown(ms) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, '0');
  if (d > 0) return `${d}d ${h}h ${m}m ${ss}s`;
  if (h > 0) return `${h}h ${m}m ${ss}s`;
  return `${m}m ${ss}s`;
}

// Countdown broken into padded D/H/M/S parts for the hero digit boxes.
function countdownParts(ms) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return {
    d: String(Math.floor(s / 86400)),
    h: String(Math.floor((s % 86400) / 3600)).padStart(2, '0'),
    m: String(Math.floor((s % 3600) / 60)).padStart(2, '0'),
    s: String(s % 60).padStart(2, '0'),
  };
}

export default function HomeScreen() {
  const { t } = useI18n();
  const [weather, setWeather] = useState(null);
  const [upcoming, setUpcoming] = useState(null);
  const [forecasts, setForecasts] = useState({});
  const [circuitGeo, setCircuitGeo] = useState(null);
  const [lastRace, setLastRace] = useState(null);
  const [lastQuali, setLastQuali] = useState(null);
  const [resultView, setResultView] = useState('race'); // 'race' | 'quali'
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [timeMode, setTimeModeState] = useState('local');

  useEffect(() => { getTimeMode().then(setTimeModeState); }, []);

  async function toggleTimeMode() {
    const next = timeMode === 'local' ? 'track' : 'local';
    setTimeModeState(next);
    await setTimeMode(next);
  }

  // Tick every second so the countdown updates live.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const bootstrap = useCallback(async () => {
    const [schedule, last, quali] = await Promise.all([
      fetchSchedule().catch(() => []),
      fetchLastRace().catch(() => null),
      fetchLastQualifying().catch(() => null),
    ]);
    const r = nextRace(schedule);
    setUpcoming(r);
    setLastRace(last);
    setLastQuali(quali);
    if (r?.lat && r?.lon) {
      fetchCurrentWeather(r.lat, r.lon).then(setWeather).catch(() => setWeather(null));
      fetchSessionForecasts(r.lat, r.lon, r.sessions)
        .then(setForecasts)
        .catch(() => setForecasts({}));
      fetchCircuitGeometry(r.lat, r.lon, r.circuitId)
        .then(setCircuitGeo)
        .catch(() => setCircuitGeo(null));
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Re-fetch and re-sync the clock whenever the app returns to the foreground
  // (e.g. after landing in a new time zone).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        setNow(Date.now());
        bootstrap();
      }
    });
    return () => sub.remove();
  }, [bootstrap]);

  async function onPull() {
    setRefreshing(true);
    await bootstrap();
    setRefreshing(false);
  }

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor="#fff" />;

  // Next race + session times + track weather + last result.
  const r = upcoming;
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} refreshControl={refresh}>
      {r ? (
        <>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.roundBadge}><Text style={styles.roundBadgeText}>R{r.round}</Text></View>
              <Text style={styles.heroLabel}>{t('nextRace')}</Text>
              {!!weekendRange(r.sessions) && (
                <View style={styles.dateChip}>
                  <Text style={styles.dateChipText}>{weekendRange(r.sessions)}</Text>
                </View>
              )}
            </View>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroFlag}>{countryFlag(r.country)}</Text>
              <Text style={styles.heroName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{r.name}</Text>
            </View>
            <Text style={styles.heroCircuit}>{r.circuit}</Text>
            <Text style={styles.heroWhere}>{r.locality}, {r.country}</Text>
            <View style={styles.heroBar} />
          </View>

          {(() => {
            const ns = nextSessionOf(r.sessions, now);
            const cd = ns && fmtCountdown(ns.date.getTime() - now);
            if (!ns || !cd) return null;
            return (
              <View style={styles.cdRow}>
                <Text style={styles.cdRowLabel}>{t('nextSession')} · {t(ns.labelKey)}</Text>
                <Text style={styles.cdRowTime}>{cd}</Text>
              </View>
            );
          })()}
          <TrackMap progress={0} geo={circuitGeo} />
          <CircuitStats geo={circuitGeo} />
          <WeatherBar weather={weather} />
          <View style={styles.timesCard}>
            <View style={styles.timesHead}>
              <Text style={styles.timesTitle}>{hasTrackTz(r.circuitId) ? t('sessions') : t('sessionTimes')}</Text>
              {hasTrackTz(r.circuitId) && (
                <View style={styles.segment}>
                  <TouchableOpacity onPress={toggleTimeMode} style={[styles.segBtn, timeMode === 'local' && styles.segBtnOn]}>
                    <Text style={[styles.segText, timeMode === 'local' && styles.segTextOn]}>Local</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={toggleTimeMode} style={[styles.segBtn, timeMode === 'track' && styles.segBtnOn]}>
                    <Text style={[styles.segText, timeMode === 'track' && styles.segTextOn]}>Track</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {[
              [t('practice1'), r.sessions.fp1, 'fp1'],
              [t('practice2'), r.sessions.fp2, 'fp2'],
              [t('practice3'), r.sessions.fp3, 'fp3'],
              [t('sprint'), r.sessions.sprint, 'sprint'],
              [t('qualifying'), r.sessions.qualifying, 'qualifying'],
              [t('raceSession'), r.sessions.race, 'race'],
            ].filter(([, d]) => d).map(([name, d, key]) => {
              const f = forecasts[key];
              return (
                <View key={key} style={styles.timeRow}>
                  <Text style={styles.timeName} numberOfLines={1}>{name}</Text>
                  <View style={styles.timeRight}>
                    {f && <Text style={styles.forecast}>{f.emoji} {f.temp}°</Text>}
                    <Text style={styles.timeVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{fmtSessionRange(d, timeMode, r.circuitId, key)}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {lastRace && (() => {
            const showQuali = resultView === 'quali' && lastQuali;
            const rows = showQuali ? lastQuali.results : lastRace.results;
            return (
            <>
              <CheckeredLine />
              <View style={styles.timesCard}>
                <Text style={styles.timesTitle} numberOfLines={2}>{t('lastRace')} · {lastRace.name}</Text>
                <View style={[styles.segment, styles.segmentRow]}>
                  <TouchableOpacity onPress={() => setResultView('race')} style={[styles.segBtn, styles.segBtnFlex, resultView === 'race' && styles.segBtnOn]}>
                    <Text style={[styles.segText, resultView === 'race' && styles.segTextOn]}>{t('raceSession')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setResultView('quali')} style={[styles.segBtn, styles.segBtnFlex, resultView === 'quali' && styles.segBtnOn]}>
                    <Text style={[styles.segText, resultView === 'quali' && styles.segTextOn]}>{t('qualifying')}</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={{ maxHeight: ROW_H * 10 }}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {rows.map((d) => (
                    <View key={d.code} style={styles.resRow}>
                      <Text style={styles.resPos}>{medal(d.position) || d.position}</Text>
                      <View style={[styles.teamDot, { backgroundColor: d.color }]} />
                      <Text style={styles.resName}>{d.code} · {d.team}</Text>
                      {!showQuali && d.pole && <Text style={styles.poleTag}>POLE</Text>}
                      {!showQuali && d.fastestLap && <Text style={styles.flTag}>FL</Text>}
                      {showQuali && d.gapLabel ? <Text style={styles.qGap}>{d.gapLabel}</Text> : null}
                      <Text style={styles.resTime}>{d.time}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </>
            );
          })()}

        </>
      ) : <Text style={styles.loading}>{t('loading')}</Text>}
      <Text style={styles.credit}>GridLine — created by Hisham</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 90 },
  loading: { color: '#888', marginTop: 10 },
  teamDot: { width: 8, height: 18, borderRadius: 2, marginRight: 10 },
  hero: { marginBottom: 16 },
  heroTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  roundBadge: { backgroundColor: '#E8002D', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginRight: 10 },
  roundBadgeText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  heroLabel: { color: '#FF8000', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center' },
  heroFlag: { fontSize: rf(32), marginRight: 10 },
  heroName: { color: '#fff', fontSize: rf(26), fontWeight: '900', flex: 1, lineHeight: rf(30) },
  heroCircuit: { color: '#ddd', fontSize: 15, marginTop: 6 },
  heroWhere: { color: '#888', fontSize: 13, marginTop: 2 },
  heroBar: { height: 3, backgroundColor: '#E8002D', borderRadius: 2, marginTop: 12, width: 64 },
  dateChip: { marginLeft: 'auto', backgroundColor: '#1d1d1d', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#333' },
  dateChipText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  timesHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  segment: { flexDirection: 'row', backgroundColor: '#0d0d0d', borderRadius: 8, padding: 2 },
  segmentRow: { marginTop: 10, marginBottom: 2, alignSelf: 'stretch' },
  segBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  segBtnFlex: { flex: 1, alignItems: 'center' },
  segBtnOn: { backgroundColor: '#E8002D' },
  segText: { color: '#999', fontSize: 12, fontWeight: '700' },
  segTextOn: { color: '#fff' },
  cdRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#161616', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: '#E8002D' },
  cdRowLabel: { color: '#aaa', fontSize: 12, fontWeight: '700', flex: 1 },
  cdRowTime: { color: '#fff', fontSize: rf(15), fontWeight: '800', fontVariant: ['tabular-nums'] },
  timesCard: { backgroundColor: '#161616', borderRadius: 14, padding: 14, marginBottom: 14 },
  timesTitle: { color: '#bbb', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#202020' },
  timeName: { color: '#fff', fontSize: rf(13), fontWeight: '600' },
  timeRight: { flexDirection: 'row', alignItems: 'center' },
  forecast: { color: '#7fd1ff', fontSize: 13, marginRight: 10, fontWeight: '600' },
  timeVal: { color: '#bbb', fontSize: rf(12) },
  resRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#202020' },
  resPos: { color: '#fff', width: 24, fontSize: 14, fontWeight: '700' },
  resName: { color: '#ddd', flex: 1, fontSize: 14 },
  resTime: { color: '#999', fontSize: 12, fontVariant: ['tabular-nums'] },
  poleTag: { color: '#000', backgroundColor: '#b388ff', fontSize: 9, fontWeight: '800', marginRight: 6, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, overflow: 'hidden' },
  flTag: { color: '#000', backgroundColor: '#b388ff', fontSize: 9, fontWeight: '800', marginRight: 6, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, overflow: 'hidden' },
  qGap: { color: '#ff9f43', fontSize: 12, fontWeight: '700', marginRight: 8, fontVariant: ['tabular-nums'] },
  credit: { color: '#444', textAlign: 'center', marginTop: 10, fontSize: 11 },
});
