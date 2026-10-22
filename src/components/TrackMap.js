import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { TRACK } from '../data/f1Data';

const DRS_COLOR = '#E8002D';
const SECTORS = [
  { key: 'S1', color: '#00D1FF' }, // cyan
  { key: 'S2', color: '#7C5CFF' }, // indigo
  { key: 'S3', color: '#FF4D9D' }, // pink
];

// Minimalist circuit: a clean light track line, DRS straights highlighted in
// red, a chequered start/finish line, and the leader dot. Uses real geometry
// when `geo` is given, otherwise a stylised shape.
export default function TrackMap({ progress = 0, geo }) {
  const hasReal = geo && geo.points && geo.points.length > 3;
  const base = hasReal ? geo.points : TRACK.points;
  const loop = base[0] === base[base.length - 1] ? base : [...base, base[0]];
  const span = loop.length - 1;
  const loopStr = loop.map((p) => p.join(',')).join(' ');

  // Split the loop into 3 sector paths (approximate thirds).
  const b1 = Math.round(span / 3);
  const b2 = Math.round((2 * span) / 3);
  const sectorPaths = [
    loop.slice(0, b1 + 1),
    loop.slice(b1, b2 + 1),
    loop.slice(b2, span + 1),
  ].map((seg) => seg.map((p) => p.join(',')).join(' '));

  // DRS straights (on-track, highlighted).
  const drsSegs = hasReal && geo.drs
    ? geo.drs.map(([from, to]) => base.slice(from, to + 1).map((p) => p.join(',')).join(' '))
    : [];

  // Leader position.
  const pos = (progress % 1) * span;
  const i = Math.floor(pos);
  const tt = pos - i;
  const a = loop[i];
  const b = loop[i + 1] || loop[0];
  const cx = a[0] + (b[0] - a[0]) * tt;
  const cy = a[1] + (b[1] - a[1]) * tt;

  // Start/finish orientation.
  const si = hasReal ? 0 : TRACK.startIndex;
  const start = base[si];
  const prev = base[(si - 1 + base.length) % base.length];
  const next = base[(si + 1) % base.length];
  let dx = next[0] - prev[0];
  let dy = next[1] - prev[1];
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  const half = 3.6;
  const px = -dy * half; // perpendicular across the track
  const py = dx * half;

  return (
    <View style={styles.card}>
      <Svg viewBox="0 0 100 100" style={styles.svg}>
        {/* soft casing */}
        <Polyline points={loopStr} fill="none" stroke="#1e1e1e"
          strokeWidth={hasReal ? 5 : 7} strokeLinejoin="round" strokeLinecap="round" />
        {/* coloured sector lines */}
        {sectorPaths.map((d, idx) => (
          <Polyline key={`sec${idx}`} points={d} fill="none" stroke={SECTORS[idx].color}
            strokeWidth={hasReal ? 2.4 : 3} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {/* DRS straights */}
        {drsSegs.map((d, idx) => (
          <Polyline key={`drs${idx}`} points={d} fill="none" stroke={DRS_COLOR}
            strokeWidth={hasReal ? 2.8 : 3.4} strokeLinecap="round" />
        ))}
        {/* chequered start/finish (two offset rows of black/white dashes) */}
        {[-0.9, 0.9].map((off, ri) => {
          const ax = start[0] - px + dx * off, ay = start[1] - py + dy * off;
          const bx = start[0] + px + dx * off, by = start[1] + py + dy * off;
          return (
            <React.Fragment key={`sf${ri}`}>
              <Line x1={ax} y1={ay} x2={bx} y2={by} stroke="#111" strokeWidth={1.8} />
              <Line x1={ax} y1={ay} x2={bx} y2={by} stroke="#fff" strokeWidth={1.8}
                strokeDasharray="1.3,1.3" strokeDashoffset={ri ? 1.3 : 0} />
            </React.Fragment>
          );
        })}
        {/* leader */}
        <Circle cx={cx} cy={cy} r={2.4} fill={DRS_COLOR} stroke="#fff" strokeWidth={0.8} />
      </Svg>
      <View style={styles.legend}>
        {SECTORS.map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>{s.key}</Text>
          </View>
        ))}
        {drsSegs.length > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: DRS_COLOR }]} />
            <Text style={styles.legendText}>DRS</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#161616', borderRadius: 14, padding: 12, marginBottom: 14 },
  svg: { width: '100%', aspectRatio: 1 },
  legend: { flexDirection: 'row', justifyContent: 'center', marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
  swatch: { width: 12, height: 4, borderRadius: 2, marginRight: 5 },
  legendText: { color: '#999', fontSize: 11, fontWeight: '700' },
  checker: { flexDirection: 'row', flexWrap: 'wrap', width: 10, height: 10, marginRight: 5, borderRadius: 1, overflow: 'hidden' },
  checkCell: { width: 5, height: 5, backgroundColor: '#fff' },
  checkDark: { backgroundColor: '#111' },
});
