import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import { fetchLiveSession, TRACK } from '../data/f1Data';
import {
  REAL_REFRESH_MS, fetchSessionMeta, fetchWeather, fetchRaceControl,
  fetchCarSpeeds, fetchTeamRadio,
} from '../data/openf1';
import { Linking, AppState } from 'react-native';
import { fetchSchedule, nextRace, fetchLastRace, fetchLastQualifying } from '../data/jolpica';
import { fetchSessionForecasts, fetchCurrentWeather } from '../data/forecast';
import { fetchCircuitGeometry } from '../data/circuit';
import { getDelaySec, getNoSpoiler, isFeedUnlocked, unlockFeed, getTimeMode, setTimeMode } from '../settings';
import { fmtSessionRange, weekendRange, hasTrackTz } from '../trackTime';
import { useI18n } from '../i18n';
import { countryFlag } from '../flags';
import { medal } from '../medals';
import { rf } from '../responsive';
import TrackMap from '../components/TrackMap';
import CircuitStats from '../components/CircuitStats';
import LiveSessionScreen from './LiveSessionScreen';
import CheckeredLine from '../components/CheckeredLine';
import WeatherBar from '../components/WeatherBar';

const ROW_H = 35; // approx height of one result row, for the 10-row scroll window

const STATUS_STYLE = {
  CLEAR: { bg: '#0a7d32', label: 'TRACK CLEAR' },
  GREEN: { bg: '#0a7d32', label: 'TRACK CLEAR' },
  YELLOW: { bg: '#c99700', label: 'YELLOW FLAG' },
  RED: { bg: '#c0162c', label: 'RED FLAG' },
  FINISHED: { bg: '#333', label: 'FINISHED' },
  UNKNOWN: { bg: '#333', label: '—' },
};

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

export default function LiveScreen() {
  const { t } = useI18n();
  const [meta, setMeta] = useState(null);
  const [weather, setWeather] = useState(null);
  const [session, setSession] = useState(null);
  const [rc, setRc] = useState(null);
  const [speeds, setSpeeds] = useState({});
  const [radio, setRadio] = useState([]);
  const [upcoming, setUpcoming] = useState(null);
  const [forecasts, setForecasts] = useState({});
  const [circuitGeo, setCircuitGeo] = useState(null);
  const [lastRace, setLastRace] = useState(null);
  const [lastQuali, setLastQuali] = useState(null);
  const [resultView, setResultView] = useState('race'); // 'race' | 'quali'
  const [noSpoiler, setNoSpoiler] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [delay, setDelay] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [showLive, setShowLive] = useState(false);
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
  const timer = useRef(null);

  const loadLive = useCallback(async (cutoffMs) => {
    const [s, rcData, spd, rad] = await Promise.all([
      fetchLiveSession({ cutoffMs }).catch(() => null),
      fetchRaceControl(15, cutoffMs).catch(() => null),
      fetchCarSpeeds(cutoffMs).catch(() => ({})),
      fetchTeamRadio(12, cutoffMs).catch(() => []),
    ]);
    if (s) setSession(s);
    if (rcData) setRc(rcData);
    setSpeeds(spd || {});
    setRadio(rad || []);
  }, []);

  const bootstrap = useCallback(async () => {
    const [m, ns, d] = await Promise.all([
      fetchSessionMeta().catch(() => null),
      getNoSpoiler(),
      getDelaySec(),
    ]);
    setMeta(m);
    setNoSpoiler(ns);
    setDelay(d);

    // Always populate the home screen (next/current race) so it shows even
    // during the live window; the live timing view is opened by tapping in.
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
    if (m?.live) {
      const u = await isFeedUnlocked(m.session_key);
      setUnlocked(u);
    }
  }, [loadLive]);

  useEffect(() => {
    bootstrap();
    return () => clearInterval(timer.current);
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

  // Poll only during a live, revealed session.
  useEffect(() => {
    clearInterval(timer.current);
    if (meta?.live && (!noSpoiler || unlocked)) {
      timer.current = setInterval(() => {
        loadLive(delay ? Date.now() - delay * 1000 : 0);
      }, REAL_REFRESH_MS);
    }
    return () => clearInterval(timer.current);
  }, [meta, noSpoiler, unlocked, delay, loadLive]);

  async function onReveal() {
    await unlockFeed(meta.session_key);
    setUnlocked(true);
    await loadLive(delay ? Date.now() - delay * 1000 : 0);
  }

  async function onPull() {
    setRefreshing(true);
    await bootstrap();
    setRefreshing(false);
  }

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor="#fff" />;

  // Replay / live timing full-screen view.
  if (showLive) return <LiveSessionScreen onBack={() => setShowLive(false)} />;

  // ---- NOT a live session: show next race + times + weather ----
  if (upcoming) {
    const r = upcoming;
    const sessionLive = meta?.live;
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
            <TouchableOpacity style={[styles.liveBtn, sessionLive && styles.liveBtnOn]} onPress={() => setShowLive(true)}>
              <View style={styles.liveBtnDot} />
              <Text style={styles.liveBtnText}>
                {sessionLive
                  ? `LIVE NOW · ${meta.session_name} — open timing & track updates`
                  : 'Live timing · circuit, standings & track updates'}
              </Text>
              <Text style={styles.liveBtnChev}>›</Text>
            </TouchableOpacity>
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

            <Text style={styles.note}>{t('feedOpensAuto')}</Text>
          </>
        ) : <Text style={styles.loading}>{t('loading')}</Text>}
        <Text style={styles.credit}>Race Live Companion — created by Hisham</Text>
      </ScrollView>
    );
  }

  // ---- Live session, but no-spoiler gate not yet revealed ----
  if (meta?.live && noSpoiler && !unlocked) {
    return (
      <View style={styles.gate}>
        <Text style={styles.liveBadge}>{t('liveNow')}</Text>
        <Text style={styles.gp}>{meta.session_name}</Text>
        <Text style={styles.where}>{meta.country_name}</Text>
        <Text style={styles.gateNote}>{t('noSpoilerGate')}</Text>
        <TouchableOpacity style={styles.revealBtn} onPress={onReveal}>
          <Text style={styles.revealText}>{t('showLiveFeed')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---- Live feed: the full 3-tab live session view ----

  if (!session) {
    return <View style={styles.loadingWrap}><Text style={styles.loading}>{t('connecting')}</Text></View>;
  }

  const status = STATUS_STYLE[rc?.trackStatus] || STATUS_STYLE.UNKNOWN;
  const progress = session.lap / Math.max(1, session.totalLaps);
  const isRace = /race/i.test(session.sessionType);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} refreshControl={refresh}>
      <View style={styles.header}>
        <View>
          <Text style={styles.gp}>{countryFlag(meta?.country_name)} {session.grandPrix}</Text>
          <Text style={styles.sessionLine}>{session.sessionName} · Lap {session.lap}</Text>
        </View>
        <Text style={styles.liveTag}>{t('live')}</Text>
      </View>

      <TrackMap progress={progress} geo={circuitGeo} />

      <View style={[styles.statusBar, { backgroundColor: status.bg }]}>
        <Text style={styles.statusText}>{status.label}</Text>
        {delay > 0 && <Text style={styles.delayTag}>TV −{delay}s</Text>}
      </View>

      <WeatherBar weather={weather} />

      <Text style={styles.sectionTitle}>{t('results')}</Text>
      {session.standings.map((d) => (
        <View key={d.code} style={styles.row}>
          <Text style={[styles.cell, styles.pos]}>{d.position}</Text>
          <View style={[styles.drv, styles.drvCell]}>
            <View style={[styles.teamDot, { backgroundColor: d.color }]} />
            <Text style={styles.code}>{d.code}</Text>
            {!!d.number && <Text style={styles.numTag}>#{d.number}</Text>}
            {d.pit && <Text style={styles.pit}>PIT</Text>}
          </View>
          {speeds[d.number] != null && (
            <Text style={styles.speed}>{speeds[d.number]} km/h</Text>
          )}
          <Text style={[styles.cell, styles.gap]}>{isRace ? d.gapLabel : d.lastLap}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>{t('raceControl')}</Text>
      {rc?.messages?.length ? rc.messages.map((m, i) => (
        <View key={i} style={styles.rcRow}>
          <View style={[styles.rcBar, m.isPenalty ? styles.rcPenalty : m.flag ? styles.rcFlag : styles.rcInfo]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rcMsg}>{m.message}</Text>
            {!!m.lap && <Text style={styles.rcMeta}>Lap {m.lap}{m.flag ? ` · ${m.flag}` : ''}</Text>}
          </View>
        </View>
      )) : <Text style={styles.loading}>{t('noMessages')}</Text>}

      <Text style={styles.sectionTitle}>{t('teamRadio')}</Text>
      {radio?.length ? radio.map((r, i) => {
        const drv = session.standings.find((d) => d.number === r.driver);
        return (
          <TouchableOpacity key={i} style={styles.radioRow} onPress={() => Linking.openURL(r.url)}>
            <View style={[styles.teamDot, { backgroundColor: drv?.color || '#888' }]} />
            <Text style={styles.radioDrv}>{drv?.code || `#${r.driver}`}</Text>
            <Text style={styles.radioTime}>{r.date.toLocaleTimeString()}</Text>
            <Text style={styles.radioPlay}>{t('playRadio')}</Text>
          </TouchableOpacity>
        );
      }) : <Text style={styles.loading}>{t('noRadio')}</Text>}

      <Text style={styles.credit}>Race Live Companion — created by Hisham</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 90 },
  loadingWrap: { flex: 1, backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center' },
  loading: { color: '#888', marginTop: 10 },
  label: { color: '#FF8000', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  gp: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 2 },
  circuit: { color: '#ddd', fontSize: 15, marginTop: 4 },
  where: { color: '#999', fontSize: 14, marginTop: 2, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sessionLine: { color: '#999', marginTop: 2 },
  liveTag: { color: '#E8002D', fontWeight: '800', fontSize: 13 },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 14 },
  statusText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  delayTag: { color: '#fff', fontSize: 12, fontWeight: '700', opacity: 0.85 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 8, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#191919' },
  cell: { color: '#eee', fontSize: 15 },
  pos: { width: 28 },
  drv: { flex: 1 },
  drvCell: { flexDirection: 'row', alignItems: 'center' },
  teamDot: { width: 8, height: 18, borderRadius: 2, marginRight: 10 },
  code: { color: '#fff', fontWeight: '700', fontSize: 15 },
  numTag: { color: '#888', fontSize: 12, fontWeight: '700', marginLeft: 8 },
  pit: { color: '#000', backgroundColor: '#f6c344', fontSize: 10, fontWeight: '800', marginLeft: 8, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, overflow: 'hidden' },
  speed: { color: '#7fd1ff', fontSize: 12, fontWeight: '700', width: 64, textAlign: 'right' },
  gap: { width: 84, textAlign: 'right', fontVariant: ['tabular-nums'] },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#171717' },
  radioDrv: { color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 10, width: 46 },
  radioTime: { color: '#888', fontSize: 12, flex: 1 },
  radioPlay: { color: '#E8002D', fontWeight: '700', fontSize: 13 },
  rcRow: { flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#171717' },
  rcBar: { width: 4, borderRadius: 2, marginRight: 10 },
  rcFlag: { backgroundColor: '#c99700' },
  rcPenalty: { backgroundColor: '#E8002D' },
  rcInfo: { backgroundColor: '#555' },
  rcMsg: { color: '#ddd', fontSize: 13, lineHeight: 18 },
  rcMeta: { color: '#777', fontSize: 11, marginTop: 2 },
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
  liveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161616', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  liveBtnOn: { backgroundColor: '#2a1012', borderColor: '#E8002D' },
  liveBtnDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E8002D', marginRight: 10 },
  liveBtnText: { color: '#fff', fontSize: rf(13), fontWeight: '700', flex: 1 },
  liveBtnChev: { color: '#777', fontSize: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#161616', borderRadius: 18, padding: 22, borderWidth: 1, borderColor: '#2a2a2a' },
  modalClose: { position: 'absolute', top: 12, right: 14, zIndex: 2, padding: 4 },
  modalCloseText: { color: '#888', fontSize: 20, fontWeight: '700' },
  modalTitle: { color: '#fff', fontSize: rf(18), fontWeight: '900', marginTop: 4 },
  modalSub: { color: '#aaa', fontSize: rf(12.5), marginTop: 6, marginBottom: 16, lineHeight: 18 },
  modalInput: {
    backgroundColor: '#1f1f1f', color: '#fff', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 15,
    fontSize: rf(15), letterSpacing: 1, borderWidth: 1, borderColor: '#333',
  },
  modalErr: { color: '#ff6b6b', fontSize: rf(12), marginTop: 8 },
  modalBtn: { backgroundColor: '#E8002D', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  modalBtnText: { color: '#fff', fontWeight: '800', fontSize: rf(14) },
  modalDivider: { height: 1, backgroundColor: '#2a2a2a', marginVertical: 18 },
  modalContactLabel: { color: '#888', fontSize: rf(11.5), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  buyRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#13241b', borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 15, borderWidth: 1, borderColor: '#1f7a4d',
  },
  buyTitle: { color: '#fff', fontSize: rf(14), fontWeight: '800' },
  buySub: { color: '#9fd9bb', fontSize: rf(11.5), marginTop: 2 },
  buyPrice: { color: '#35d07f', fontSize: rf(15), fontWeight: '900', marginLeft: 10 },
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
  scrollHint: { color: '#666', fontSize: 11, textAlign: 'center', marginTop: 8 },
  note: { color: '#666', fontSize: 12, marginBottom: 10 },
  credit: { color: '#444', textAlign: 'center', marginTop: 10, fontSize: 11 },
  gate: { flex: 1, backgroundColor: '#0d0d0d', padding: 28, justifyContent: 'center' },
  liveBadge: { color: '#E8002D', fontWeight: '800', fontSize: 14 },
  gateNote: { color: '#aaa', marginTop: 16, lineHeight: 21 },
  revealBtn: { backgroundColor: '#E8002D', borderRadius: 12, padding: 16, marginTop: 24, alignItems: 'center' },
  revealText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
