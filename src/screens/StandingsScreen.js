import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import {
  fetchStandings, fetchConstructorStandings,
  fetchDriverStandingsAt, fetchConstructorStandingsAt, fetchSchedule,
} from '../data/jolpica';
import { isChampion, DRIVER_PER_ROUND, TEAM_PER_ROUND } from '../medals';
import { getFavDriver, setFavDriver, getFavTeam, setFavTeam } from '../settings';
import { useI18n } from '../i18n';
import DriverDetailScreen from './DriverDetailScreen';
import TeamDetailScreen from './TeamDetailScreen';

// Up/down/same indicator with points gained last race.
function Movement({ prev, position, points }) {
  if (!prev) return null;
  const change = prev.position - position;
  const gained = points - prev.points;
  const arrow = change > 0 ? `▲${change}` : change < 0 ? `▼${-change}` : '–';
  const color = change > 0 ? '#2ec27e' : change < 0 ? '#ff5a5a' : '#888';
  return (
    <View style={styles.move}>
      <Text style={[styles.moveArrow, { color }]}>{arrow}</Text>
      {gained > 0 && <Text style={styles.movePts}>+{gained}</Text>}
    </View>
  );
}

export default function StandingsScreen() {
  const { t } = useI18n();
  const [view, setView] = useState('drivers');
  const [data, setData] = useState(null);
  const [teams, setTeams] = useState(null);
  const [prevDrivers, setPrevDrivers] = useState({});
  const [prevTeams, setPrevTeams] = useState({});
  const [totalRounds, setTotalRounds] = useState(0);
  const [favDriver, setFavD] = useState(null);
  const [favTeam, setFavT] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [driver, setDriver] = useState(null);
  const [team, setTeam] = useState(null);

  async function load() {
    try {
      const [d, c] = await Promise.all([
        fetchStandings().catch(() => null),
        fetchConstructorStandings().catch(() => null),
      ]);
      setData(d);
      setTeams(c);
      setError('');
      fetchSchedule().then((s) => setTotalRounds(s?.length || 0)).catch(() => {});
      const prevRound = Number(d?.round || c?.round) - 1;
      if (prevRound >= 1) {
        const [pd, pt] = await Promise.all([
          fetchDriverStandingsAt(prevRound),
          fetchConstructorStandingsAt(prevRound),
        ]);
        setPrevDrivers(pd);
        setPrevTeams(pt);
      }
    } catch (e) {
      setError('Could not load standings. Pull to retry.');
    }
  }

  useEffect(() => {
    load();
    getFavDriver().then(setFavD);
    getFavTeam().then(setFavT);
  }, []);

  async function onPull() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function toggleFavDriver(id) {
    const next = favDriver === id ? null : id;
    setFavD(next);
    await setFavDriver(next);
  }
  async function toggleFavTeam(id) {
    const next = favTeam === id ? null : id;
    setFavT(next);
    await setFavTeam(next);
  }

  if (driver) return <DriverDetailScreen driver={driver} onBack={() => setDriver(null)} />;
  if (team) {
    const teamDrivers = (data?.drivers || []).filter((d) => d.team === team.name);
    return <TeamDetailScreen team={team} drivers={teamDrivers} onBack={() => setTeam(null)} />;
  }

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor="#fff" />;

  const driverLeaderPts = data?.drivers?.[0]?.points ?? 0;
  const teamLeaderPts = teams?.teams?.[0]?.points ?? 0;
  const roundsLeft = totalRounds - Number(data?.round || teams?.round || 0);
  const driverGap12 = data?.drivers?.length >= 2 ? data.drivers[0].points - data.drivers[1].points : 0;
  const teamGap12 = teams?.teams?.length >= 2 ? teams.teams[0].points - teams.teams[1].points : 0;
  const driverChampDecided = data?.drivers?.length >= 2 && isChampion(driverGap12, roundsLeft, DRIVER_PER_ROUND);
  const teamChampDecided = teams?.teams?.length >= 2 && isChampion(teamGap12, roundsLeft, TEAM_PER_ROUND);

  // "needs N pts to clinch" for the leader (when not yet decided).
  const driverToClinch = !driverChampDecided && roundsLeft > 0
    ? roundsLeft * DRIVER_PER_ROUND - driverGap12 + 1 : 0;
  const teamToClinch = !teamChampDecided && roundsLeft > 0
    ? roundsLeft * TEAM_PER_ROUND - teamGap12 + 1 : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, view === 'drivers' && styles.tabOn]} onPress={() => setView('drivers')}>
          <Text style={[styles.tabText, view === 'drivers' && styles.tabTextOn]}>{t('drivers')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, view === 'teams' && styles.tabOn]} onPress={() => setView('teams')}>
          <Text style={[styles.tabText, view === 'teams' && styles.tabTextOn]}>{t('teams')}</Text>
        </TouchableOpacity>
      </View>

      {view === 'drivers' ? (
        <ScrollView contentContainerStyle={styles.content} refreshControl={refresh}>
          {data && <Text style={styles.sub}>{data.season} · {t('afterRound')} {data.round} · {t('tapDriver')}</Text>}
          {driverToClinch > 0 && data && (
            <Text style={styles.clinch}>{data.drivers[0].code} needs {driverToClinch} pts to clinch · {roundsLeft} rounds left</Text>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
          {data?.drivers.map((d) => {
            const champ = driverChampDecided && d.position === 1;
            const fav = favDriver === d.driverId;
            return (
              <TouchableOpacity key={d.code + d.position} style={[styles.row, fav && styles.favRow, champ && styles.championRow]} onPress={() => setDriver(d)}>
                <Text style={styles.pos}>{d.position}</Text>
                <View style={[styles.dot, { backgroundColor: d.color }]} />
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {champ ? '👑 ' : ''}{d.name}{d.number ? <Text style={styles.num}>  #{d.number}</Text> : null}
                  </Text>
                  <Text style={styles.team}>{d.team}{d.wins ? ` · ${d.wins} ${t('wins').toLowerCase()}` : ''}</Text>
                </View>
                <Movement prev={prevDrivers[d.driverId]} position={d.position} points={d.points} />
                <View style={styles.ptsCol}>
                  <Text style={styles.points}>{d.points}</Text>
                  {d.position === 1
                    ? <Text style={styles.leaderTag}>LEADER</Text>
                    : <Text style={styles.gap}>-{driverLeaderPts - d.points}</Text>}
                </View>
                <TouchableOpacity style={styles.starBtn} onPress={() => toggleFavDriver(d.driverId)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.star, fav && styles.starOn]}>{fav ? '★' : '☆'}</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
          {!data && !error && <Text style={styles.loading}>{t('loading')}</Text>}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={refresh}>
          {teams && <Text style={styles.sub}>{teams.season} · {t('afterRound')} {teams.round} · {t('tapTeam')}</Text>}
          {teamToClinch > 0 && teams && (
            <Text style={styles.clinch}>{teams.teams[0].name} needs {teamToClinch} pts to clinch · {roundsLeft} rounds left</Text>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
          {teams?.teams.map((c) => {
            const champ = teamChampDecided && c.position === 1;
            const fav = favTeam === c.constructorId;
            return (
              <TouchableOpacity key={c.constructorId + c.position} style={[styles.row, fav && styles.favRow, champ && styles.championRow]} onPress={() => setTeam(c)}>
                <Text style={styles.pos}>{c.position}</Text>
                <View style={[styles.dot, { backgroundColor: c.color }]} />
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>{champ ? '👑 ' : ''}{c.name}</Text>
                  <Text style={styles.team}>{c.nationality}{c.wins ? ` · ${c.wins} ${t('wins').toLowerCase()}` : ''}</Text>
                </View>
                <Movement prev={prevTeams[c.constructorId]} position={c.position} points={c.points} />
                <View style={styles.ptsCol}>
                  <Text style={styles.points}>{c.points}</Text>
                  {c.position === 1
                    ? <Text style={styles.leaderTag}>LEADER</Text>
                    : <Text style={styles.gap}>-{teamLeaderPts - c.points}</Text>}
                </View>
                <TouchableOpacity style={styles.starBtn} onPress={() => toggleFavTeam(c.constructorId)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.star, fav && styles.starOn]}>{fav ? '★' : '☆'}</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
          {!teams && !error && <Text style={styles.loading}>{t('loading')}</Text>}
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
  sub: { color: '#999', marginBottom: 6, fontSize: 13 },
  clinch: { color: '#D4AF37', fontSize: 12, fontWeight: '700', marginBottom: 12 },
  error: { color: '#ff6b6b', marginBottom: 12 },
  loading: { color: '#888', marginTop: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#191919',
  },
  pos: { color: '#fff', width: 28, fontSize: 16, fontWeight: '700' },
  dot: { width: 8, height: 26, borderRadius: 2, marginRight: 12 },
  info: { flex: 1 },
  name: { color: '#fff', fontSize: 16, fontWeight: '600' },
  num: { color: '#888', fontSize: 13, fontWeight: '700' },
  team: { color: '#999', fontSize: 13, marginTop: 1 },
  ptsCol: { alignItems: 'flex-end', minWidth: 52 },
  points: { color: '#fff', fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  gap: { color: '#ff9f43', fontSize: 11, fontWeight: '700', marginTop: 1, fontVariant: ['tabular-nums'] },
  leaderTag: { color: '#2ec27e', fontSize: 10, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
  starBtn: { paddingLeft: 10 },
  star: { color: '#555', fontSize: 18 },
  starOn: { color: '#FFD23F' },
  championRow: { backgroundColor: '#1c1708', borderRadius: 10, paddingHorizontal: 8, borderBottomColor: 'transparent', borderWidth: 1, borderColor: '#D4AF37' },
  favRow: { backgroundColor: '#10171f', borderRadius: 10, paddingHorizontal: 8, borderBottomColor: 'transparent' },
  move: { alignItems: 'flex-end', width: 42, marginRight: 8 },
  moveArrow: { fontSize: 12, fontWeight: '800' },
  movePts: { color: '#2ec27e', fontSize: 11, fontWeight: '700', marginTop: 1 },
});
