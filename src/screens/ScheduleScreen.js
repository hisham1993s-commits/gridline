import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Modal } from 'react-native';
import { fetchSchedule, fetchRaceResultsAt } from '../data/jolpica';
import { medal } from '../medals';
import { useI18n } from '../i18n';
import { fmtSessionRange, weekendRange } from '../trackTime';
import { getTimeMode, setTimeMode } from '../settings';

function fmtDate(d) {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  } catch { return d; }
}

export default function ScheduleScreen() {
  const { t } = useI18n();
  const [races, setRaces] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [results, setResults] = useState({}); // round -> top 3 finishers
  const [timeMode, setTimeModeState] = useState('local');
  const [resultModal, setResultModal] = useState(null); // { name, round, results }
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => { getTimeMode().then(setTimeModeState); }, []);
  async function toggleTimeMode() {
    const next = timeMode === 'local' ? 'track' : 'local';
    setTimeModeState(next);
    await setTimeMode(next);
  }

  function toggle(r) {
    const open = expanded === r.round;
    setExpanded(open ? null : r.round);
    // For a finished race, load its top 3 once (on first expand).
    if (!open && r.date < today && !results[r.round]) {
      fetchRaceResultsAt(r.round, 3)
        .then((top) => setResults((prev) => ({ ...prev, [r.round]: top })))
        .catch(() => {});
    }
  }

  function openFullResult(r) {
    setResultModal({ name: r.name, round: r.round, results: null });
    fetchRaceResultsAt(r.round, 30)
      .then((rows) => setResultModal((m) => (m && m.round === r.round ? { ...m, results: rows } : m)))
      .catch(() => setResultModal((m) => (m ? { ...m, results: [] } : m)));
  }

  async function load() {
    try {
      setRaces(await fetchSchedule());
      setError('');
    } catch (e) {
      setError('Could not load schedule. Pull to retry.');
    }
  }

  useEffect(() => { load(); }, []);

  async function onPull() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <>
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor="#fff" />}
    >
      <View style={styles.headRow}>
        <Text style={styles.h1}>{t('seasonSchedule')}</Text>
        <View style={styles.segment}>
          <TouchableOpacity onPress={toggleTimeMode} style={[styles.segBtn, timeMode === 'local' && styles.segBtnOn]}>
            <Text style={[styles.segText, timeMode === 'local' && styles.segTextOn]}>Local</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTimeMode} style={[styles.segBtn, timeMode === 'track' && styles.segBtnOn]}>
            <Text style={[styles.segText, timeMode === 'track' && styles.segTextOn]}>Track</Text>
          </TouchableOpacity>
        </View>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}

      {races?.map((r) => {
        const upcoming = r.date >= today;
        const open = expanded === r.round;
        return (
          <TouchableOpacity
            key={r.round}
            activeOpacity={0.7}
            onPress={() => toggle(r)}
          >
            <View style={[styles.row, upcoming && styles.rowNext]}>
              <View style={styles.roundBox}>
                <Text style={styles.roundNum}>{r.round}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                <Text style={styles.where}>{r.locality}, {r.country}</Text>
              </View>
              <View style={styles.dateBox}>
                <Text style={[styles.date, upcoming && styles.dateNext]} numberOfLines={1}>{weekendRange(r.sessions) || fmtDate(r.date)}</Text>
                {upcoming && <Text style={styles.soon}>{t('upcoming')}</Text>}
              </View>
            </View>
            {open && (
              <View style={styles.times}>
                {r.date < today && results[r.round]?.length > 0 && (
                  <TouchableOpacity style={styles.podium} activeOpacity={0.7} onPress={() => openFullResult(r)}>
                    {results[r.round].map((p) => (
                      <View key={p.position} style={styles.podiumRow}>
                        <Text style={styles.podiumPos}>{medal(p.position) || p.position}</Text>
                        <View style={[styles.podiumDot, { backgroundColor: p.color }]} />
                        <Text style={styles.podiumName}>{p.code}</Text>
                        <Text style={styles.podiumTeam}>{p.team}</Text>
                      </View>
                    ))}
                    <Text style={styles.fullResult}>View full result ›</Text>
                  </TouchableOpacity>
                )}
                {[
                  [t('practice1'), r.sessions.fp1, 'fp1'],
                  [t('practice2'), r.sessions.fp2, 'fp2'],
                  [t('practice3'), r.sessions.fp3, 'fp3'],
                  [t('sprint'), r.sessions.sprint, 'sprint'],
                  [t('qualifying'), r.sessions.qualifying, 'qualifying'],
                  [t('raceSession'), r.sessions.race, 'race'],
                ].filter(([, d]) => d).map(([name, d, key]) => (
                  <View key={key} style={styles.timeRow}>
                    <Text style={styles.timeName}>{name}</Text>
                    <Text style={styles.timeVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{fmtSessionRange(d, timeMode, r.circuitId, key)}</Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
      {!races && !error && <Text style={styles.loading}>Loading…</Text>}
    </ScrollView>

    <Modal visible={!!resultModal} transparent animationType="slide" onRequestClose={() => setResultModal(null)}>
      <View style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{resultModal?.name}</Text>
            <TouchableOpacity onPress={() => setResultModal(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.sheetClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 460 }}>
            {resultModal?.results === null && <Text style={styles.loading}>Loading…</Text>}
            {resultModal?.results?.length === 0 && <Text style={styles.loading}>No result available.</Text>}
            {resultModal?.results?.map((d) => (
              <View key={d.code + d.position} style={styles.resRow}>
                <Text style={styles.resPos}>{medal(d.position) || d.position}</Text>
                <View style={[styles.resDot, { backgroundColor: d.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resName} numberOfLines={1}>{d.name || d.code}</Text>
                  <Text style={styles.resTeam}>{d.team}</Text>
                </View>
                <View style={styles.resRight}>
                  <Text style={styles.resTime}>{d.time}</Text>
                  {d.points > 0 && <Text style={styles.resPts}>+{d.points}</Text>}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 90 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  h1: { color: '#fff', fontSize: 26, fontWeight: '800' },
  segment: { flexDirection: 'row', backgroundColor: '#161616', borderRadius: 8, padding: 2 },
  segBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
  segBtnOn: { backgroundColor: '#E8002D' },
  segText: { color: '#999', fontSize: 12, fontWeight: '700' },
  segTextOn: { color: '#fff' },
  error: { color: '#ff6b6b', marginBottom: 12 },
  loading: { color: '#888', marginTop: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#191919',
  },
  rowNext: { backgroundColor: '#15110c', borderRadius: 10, paddingHorizontal: 8, borderBottomColor: 'transparent' },
  roundBox: { width: 30, alignItems: 'center' },
  roundNum: { color: '#777', fontWeight: '700' },
  info: { flex: 1, marginLeft: 6 },
  name: { color: '#fff', fontSize: 15, fontWeight: '600' },
  where: { color: '#999', fontSize: 13, marginTop: 1 },
  dateBox: { alignItems: 'flex-end' },
  date: { color: '#bbb', fontSize: 13 },
  dateNext: { color: '#FF8000', fontWeight: '700' },
  soon: { color: '#FF8000', fontSize: 10, marginTop: 2 },
  times: { backgroundColor: '#141414', borderRadius: 10, padding: 10, marginBottom: 6 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  timeName: { color: '#ddd', fontSize: 13, fontWeight: '600' },
  timeVal: { color: '#999', fontSize: 12 },
  podium: { marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#262626' },
  podiumRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  podiumPos: { color: '#FF8000', width: 18, fontSize: 13, fontWeight: '800' },
  podiumDot: { width: 7, height: 15, borderRadius: 2, marginRight: 8 },
  podiumName: { color: '#fff', fontSize: 13, fontWeight: '700', width: 48 },
  podiumTeam: { color: '#999', fontSize: 12, flex: 1 },
  fullResult: { color: '#E8002D', fontSize: 12, fontWeight: '700', marginTop: 6 },
  sheetWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 28, borderTopWidth: 1, borderColor: '#333' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 },
  sheetClose: { color: '#888', fontSize: 18, fontWeight: '700', paddingLeft: 12 },
  resRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#242424' },
  resPos: { color: '#fff', width: 30, fontSize: 15, fontWeight: '800' },
  resDot: { width: 7, height: 24, borderRadius: 2, marginRight: 12 },
  resName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  resTeam: { color: '#999', fontSize: 12, marginTop: 1 },
  resRight: { alignItems: 'flex-end' },
  resTime: { color: '#ddd', fontSize: 13, fontVariant: ['tabular-nums'] },
  resPts: { color: '#2ec27e', fontSize: 11, fontWeight: '700', marginTop: 1 },
});
