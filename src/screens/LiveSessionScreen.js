import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Modal,
} from 'react-native';
import Svg, { Polyline, Circle, Rect, Text as SvgText } from 'react-native-svg';

// Pick black or white text for readability on a given team colour.
function textOn(hex) {
  if (!hex) return '#fff';
  const h = hex.replace('#', '');
  if (h.length < 6) return '#fff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#000' : '#fff';
}
import { fetchLiveField } from '../data/live';
import { useI18n } from '../i18n';

const SECTOR_COLORS = ['#00D1FF', '#7C5CFF', '#FF4D9D']; // cyan / indigo / pink
const DRS_COLOR = '#E8002D';

// Longest near-straight runs → DRS zones (same approach as the home circuit).
function detectStraights(pts, maxZones = 2) {
  if (pts.length < 4) return [];
  const ad = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
  const seg = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
    seg.push({ i0: i - 1, i1: i, len: Math.hypot(dx, dy), ang: Math.atan2(dy, dx) });
  }
  const runs = [];
  let start = 0;
  for (let i = 1; i <= seg.length; i++) {
    const turn = i < seg.length ? ad(seg[i].ang, seg[i - 1].ang) : Infinity;
    if (turn > (7 * Math.PI) / 180 || i === seg.length) {
      let len = 0; for (let j = start; j < i; j++) len += seg[j].len;
      runs.push({ from: seg[start].i0, to: seg[i - 1].i1, len });
      start = i;
    }
  }
  const total = runs.reduce((s, r) => s + r.len, 0) || 1;
  return runs.filter((r) => r.len / total > 0.06).sort((a, b) => b.len - a.len).slice(0, maxZones).map((r) => [r.from, r.to]);
}

const FLAG = {
  CLEAR: { bg: '#0a7d32', label: 'TRACK CLEAR' },
  GREEN: { bg: '#0a7d32', label: 'GREEN FLAG' },
  YELLOW: { bg: '#c99700', label: 'YELLOW FLAG' },
  RED: { bg: '#c0162c', label: 'RED FLAG' },
  FINISHED: { bg: '#333', label: 'CHEQUERED' },
  UNKNOWN: { bg: '#333', label: '—' },
};

// Full live session view: Circuit (live positions), Standings, Track updates.
export default function LiveSessionScreen({ onBack }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [sub, setSub] = useState('circuit');
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    const d = await fetchLiveField().catch(() => null);
    if (d) setData(d);
    return d;
  }, []);

  useEffect(() => {
    let active = true;
    load().then((d) => {
      if (active && d?.live) {
        timer.current = setInterval(load, 12000); // poll while live
      }
    });
    return () => { active = false; clearInterval(timer.current); };
  }, [load]);

  async function onPull() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const flag = FLAG[data?.flag] || FLAG.UNKNOWN;
  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor="#fff" />;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{data?.grandPrix || 'Session'}</Text>
          <Text style={styles.sub}>
            {data?.sessionName} · {data?.live ? '● LIVE' : 'replay (last session)'}
          </Text>
        </View>
        <View style={[styles.flagChip, { backgroundColor: flag.bg }]}>
          <Text style={styles.flagText}>{flag.label}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {[['circuit', 'Circuit'], ['standings', 'Timing'], ['track', 'Track updates']].map(([k, lbl]) => (
          <TouchableOpacity key={k} style={[styles.tab, sub === k && styles.tabOn]} onPress={() => setSub(k)}>
            <Text style={[styles.tabText, sub === k && styles.tabTextOn]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!data && <Text style={styles.loading}>{t('connecting')}</Text>}

      {data && sub === 'circuit' && (
        <View style={{ flex: 1 }}>
          <View style={styles.mapCard}>
            <Svg viewBox="0 0 100 100" style={styles.map}>
              {(() => {
                const ol = data.outline;
                if (ol.length < 4) return null;
                const span = ol.length - 1;
                const b1 = Math.round(span / 3), b2 = Math.round((2 * span) / 3);
                const sectors = [ol.slice(0, b1 + 1), ol.slice(b1, b2 + 1), ol.slice(b2)];
                const drs = detectStraights(ol, 2).map(([f, tt]) => ol.slice(f, tt + 1));
                return (
                  <>
                    <Polyline points={ol.map((p) => p.join(',')).join(' ')}
                      fill="none" stroke="#000" strokeWidth={3.2} strokeLinejoin="round" strokeLinecap="round" />
                    {sectors.map((seg, i) => (
                      <Polyline key={`s${i}`} points={seg.map((p) => p.join(',')).join(' ')}
                        fill="none" stroke={SECTOR_COLORS[i]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    ))}
                    {drs.map((seg, i) => (
                      <Polyline key={`d${i}`} points={seg.map((p) => p.join(',')).join(' ')}
                        fill="none" stroke={DRS_COLOR} strokeWidth={2.6} strokeLinecap="round" />
                    ))}
                  </>
                );
              })()}
              {/* Driver tokens: a colour pill with the 3-letter code */}
              {data.cars.map((c) => {
                const w = 8, h = 4.4, lead = c.position === 1;
                return (
                  <React.Fragment key={`car${c.number}`}>
                    <Rect
                      x={c.x - w / 2} y={c.y - h / 2} width={w} height={h} rx={2.2}
                      fill={c.color} stroke={lead ? '#fff' : '#0d0d0d'} strokeWidth={lead ? 0.8 : 0.5}
                    />
                    <SvgText
                      x={c.x} y={c.y + 1.25} fill={textOn(c.color)}
                      fontSize={2.9} fontWeight="bold" textAnchor="middle"
                    >{c.code}</SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>
          </View>
          <ScrollView style={styles.listScroll} refreshControl={refresh}>
            {data.field.map((d) => (
              <View key={d.number} style={styles.row}>
                <Text style={styles.pos}>{d.position}</Text>
                <View style={[styles.dot, { backgroundColor: d.color }]} />
                <Text style={styles.code}>{d.code}</Text>
                <Text style={styles.team} numberOfLines={1}>{d.team}</Text>
                <Text style={styles.gap}>{d.gapLabel}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {data && sub === 'standings' && (
        <ScrollView style={styles.listScroll} contentContainerStyle={{ paddingBottom: 90 }} refreshControl={refresh}>
          <View style={styles.towerHead}>
            <Text style={[styles.thPos]}>#</Text>
            <Text style={styles.thDrv}>Driver</Text>
            <Text style={styles.thGap}>Interval</Text>
            <Text style={styles.thGap}>Leader</Text>
          </View>
          {data.field.map((d) => (
            <TouchableOpacity key={d.number} style={styles.rowBig} activeOpacity={0.7} onPress={() => setSelected(d)}>
              <Text style={styles.posBig}>{d.position}</Text>
              <View style={[styles.dotBig, { backgroundColor: d.color }]} />
              <View style={{ flex: 1 }}>
                <View style={styles.drvLine}>
                  <Text style={styles.codeBig}>{d.code}</Text>
                  <Tyre compound={d.tyre} />
                  {d.pits > 0 && <Text style={styles.pitTxt}>⦿ {d.pits}</Text>}
                </View>
                <Text style={styles.team} numberOfLines={1}>{d.team}</Text>
              </View>
              <Text style={styles.intervalTxt}>{d.position === 1 ? '—' : d.interval}</Text>
              <Text style={styles.gapBig}>{d.gapLabel}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {data && sub === 'track' && (
        <ScrollView style={styles.listScroll} contentContainerStyle={{ paddingBottom: 90 }} refreshControl={refresh}>
          {data.penalties.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Penalties & decisions</Text>
              {data.penalties.map((m, i) => (
                <View key={`p${i}`} style={styles.msgRow}>
                  <View style={[styles.msgBar, { backgroundColor: '#E8002D' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.msg}>{m.message}</Text>
                    {!!m.lap && <Text style={styles.msgMeta}>Lap {m.lap}</Text>}
                  </View>
                </View>
              ))}
            </>
          )}
          <Text style={styles.sectionTitle}>Race control</Text>
          {data.messages.map((m, i) => (
            <View key={`m${i}`} style={styles.msgRow}>
              <View style={[styles.msgBar, { backgroundColor: flagColor(m.flag) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.msg}>{m.message}</Text>
                <Text style={styles.msgMeta}>{m.lap ? `Lap ${m.lap} · ` : ''}{m.flag || m.category}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            {selected && (() => {
              const used = [...new Set((selected.stints || []).map((s) => s.compound).filter(Boolean))];
              const DRY = ['SOFT', 'MEDIUM', 'HARD'];
              const notUsed = DRY.filter((c) => !used.includes(c));
              return (
                <>
                  <View style={styles.sheetHead}>
                    <View style={[styles.dotBig, { backgroundColor: selected.color, height: 28 }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetTitle}>P{selected.position} · {selected.code} <Text style={styles.num}>#{selected.number}</Text></Text>
                      <Text style={styles.team}>{selected.team}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelected(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Text style={styles.sheetClose}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cur}>
                    <View style={styles.curItem}><Text style={styles.curLbl}>CURRENT TYRE</Text><View style={styles.drvLine}><Tyre compound={selected.tyre} /><Text style={styles.curVal}>  {selected.tyre || '—'}{selected.tyreAge != null ? ` · ${selected.tyreAge} laps` : ''}</Text></View></View>
                    <View style={styles.curItem}><Text style={styles.curLbl}>PIT STOPS</Text><Text style={styles.curVal}>{selected.pits}</Text></View>
                  </View>

                  <Text style={styles.sectionTitle}>Tyre stints</Text>
                  {selected.stints && selected.stints.length ? selected.stints.map((s, i) => (
                    <View key={i} style={styles.stintRow}>
                      <Tyre compound={s.compound} />
                      <Text style={styles.stintTxt}>  {s.compound || '—'}</Text>
                      <Text style={styles.stintLaps}>Laps {s.from}–{s.to}{s.age != null ? ` · started ${s.age} laps old` : ''}</Text>
                    </View>
                  )) : <Text style={styles.msgMeta}>No tyre data.</Text>}

                  <Text style={styles.sectionTitle}>Dry compounds left (not yet used)</Text>
                  <View style={styles.drvLine}>
                    {notUsed.length ? notUsed.map((c) => (
                      <View key={c} style={styles.leftItem}><Tyre compound={c} /><Text style={styles.stintTxt}>  {c}</Text></View>
                    )) : <Text style={styles.msgMeta}>All dry compounds used.</Text>}
                  </View>
                  <Text style={styles.note}>Based on compounds run this session (full set allocation isn’t in the data feed).</Text>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const TYRE = {
  SOFT: { c: '#E8002D', l: 'S' }, MEDIUM: { c: '#F6C344', l: 'M' }, HARD: { c: '#eaeaea', l: 'H' },
  INTERMEDIATE: { c: '#2ec27e', l: 'I' }, WET: { c: '#1E6FE8', l: 'W' },
};

function Tyre({ compound }) {
  const t = TYRE[compound];
  if (!t) return null;
  return (
    <View style={[tyreStyles.badge, { borderColor: t.c }]}>
      <Text style={[tyreStyles.text, { color: t.c }]}>{t.l}</Text>
    </View>
  );
}

const tyreStyles = StyleSheet.create({
  badge: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  text: { fontSize: 10, fontWeight: '900' },
});

function flagColor(flag) {
  if (!flag) return '#555';
  const f = flag.toUpperCase();
  if (f.includes('RED')) return '#c0162c';
  if (f.includes('YELLOW')) return '#c99700';
  if (f.includes('GREEN') || f.includes('CLEAR')) return '#0a7d32';
  if (f.includes('BLUE')) return '#1E6FE8';
  return '#888';
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0d0d0d', paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  back: { color: '#E8002D', fontSize: 28, fontWeight: '800', marginRight: 10 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sub: { color: '#999', fontSize: 12, marginTop: 1 },
  flagChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  flagText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 6 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#222' },
  tabOn: { borderBottomColor: '#E8002D' },
  tabText: { color: '#888', fontSize: 13, fontWeight: '700' },
  tabTextOn: { color: '#fff' },
  loading: { color: '#888', textAlign: 'center', marginTop: 30 },
  mapCard: { backgroundColor: '#161616', borderRadius: 14, margin: 12, padding: 10 },
  map: { width: '100%', aspectRatio: 1.3 },
  listScroll: { flex: 1, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#191919' },
  pos: { color: '#fff', width: 24, fontSize: 14, fontWeight: '700' },
  dot: { width: 7, height: 16, borderRadius: 2, marginRight: 8 },
  code: { color: '#fff', fontSize: 14, fontWeight: '700', width: 44 },
  team: { color: '#999', fontSize: 12, flex: 1 },
  gap: { color: '#ff9f43', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  towerHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#222' },
  thPos: { color: '#777', width: 40, fontSize: 10, fontWeight: '800' },
  thDrv: { color: '#777', flex: 1, fontSize: 10, fontWeight: '800' },
  thGap: { color: '#777', width: 72, fontSize: 10, fontWeight: '800', textAlign: 'right' },
  rowBig: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#191919' },
  posBig: { color: '#fff', width: 28, fontSize: 16, fontWeight: '800' },
  dotBig: { width: 8, height: 24, borderRadius: 2, marginRight: 12 },
  drvLine: { flexDirection: 'row', alignItems: 'center' },
  codeBig: { color: '#fff', fontSize: 15, fontWeight: '700' },
  num: { color: '#888', fontSize: 12 },
  pitTxt: { color: '#aaa', fontSize: 11, fontWeight: '700', marginLeft: 8 },
  intervalTxt: { color: '#ddd', fontSize: 13, fontWeight: '700', width: 72, textAlign: 'right', fontVariant: ['tabular-nums'] },
  gapBig: { color: '#ff9f43', fontSize: 13, fontWeight: '700', width: 72, textAlign: 'right', fontVariant: ['tabular-nums'] },
  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  msgRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#171717' },
  msgBar: { width: 4, borderRadius: 2, marginRight: 10 },
  msg: { color: '#ddd', fontSize: 13, lineHeight: 18 },
  msgMeta: { color: '#777', fontSize: 11, marginTop: 2 },
  sheetWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 28, borderTopWidth: 1, borderColor: '#333' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sheetClose: { color: '#888', fontSize: 18, fontWeight: '700', paddingLeft: 12 },
  cur: { flexDirection: 'row', marginBottom: 6 },
  curItem: { flex: 1 },
  curLbl: { color: '#777', fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  curVal: { color: '#fff', fontSize: 15, fontWeight: '700' },
  stintRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#242424' },
  stintTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  stintLaps: { color: '#999', fontSize: 12, marginLeft: 'auto' },
  leftItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  note: { color: '#666', fontSize: 11, marginTop: 10, lineHeight: 15 },
});
