import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, BackHandler } from 'react-native';
import { useI18n } from '../i18n';
import { TEAM_INFO } from '../data/teamInfo';

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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

export default function TeamDetailScreen({ team, drivers = [], onBack }) {
  const { t } = useI18n();
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => sub.remove();
  }, [onBack]);
  const info = TEAM_INFO[team.constructorId] || {};
  const initials = (team.name || '').split(' ').map((p) => p[0]).slice(0, 2).join('');

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.back} onPress={onBack}>
        <Text style={styles.backText}>‹ {t('teams')}</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.banner, { backgroundColor: team.color }]}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
        <Text style={styles.name}>{team.name}</Text>
        <Text style={styles.meta}>{team.nationality} · P{team.position}</Text>

        <View style={styles.statsRow}>
          <Stat label={t('pointsLabel')} value={team.points} />
          <Stat label={t('wins')} value={team.wins} />
          <Stat label={t('titles')} value={info.titles ?? '—'} />
        </View>

        <View style={styles.infoCard}>
          <InfoRow label={t('base')} value={info.base || '—'} />
          <InfoRow label={t('powerUnit')} value={info.powerUnit || '—'} />
          <InfoRow label={t('firstEntry')} value={info.firstEntry || '—'} />
          <InfoRow label={t('nationality')} value={team.nationality || '—'} />
        </View>

        {drivers.length > 0 && (
          <>
            <Text style={styles.driversTitle}>{t('drivers')}</Text>
            {drivers.map((d) => (
              <View key={d.driverId || d.code} style={styles.driverRow}>
                <View style={[styles.driverDot, { backgroundColor: d.color }]} />
                <Text style={styles.driverName}>{d.name}{d.number ? `  #${d.number}` : ''}</Text>
                <Text style={styles.driverPts}>{d.points} pts</Text>
              </View>
            ))}
          </>
        )}

        {!!team.url && (
          <TouchableOpacity style={styles.link} onPress={() => Linking.openURL(team.url)}>
            <Text style={styles.linkText}>{t('fullProfile')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0d0d0d' },
  back: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 6 },
  backText: { color: '#E8002D', fontSize: 16, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 90 },
  banner: { height: 72, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  initials: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: 1 },
  name: { color: '#fff', fontSize: 24, fontWeight: '800' },
  meta: { color: '#999', fontSize: 14, marginTop: 2, marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  stat: { backgroundColor: '#161616', borderRadius: 10, paddingVertical: 12, flex: 1, marginHorizontal: 3, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#999', fontSize: 11, marginTop: 3 },
  infoCard: { backgroundColor: '#161616', borderRadius: 12, padding: 6, marginBottom: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#202020' },
  infoLabel: { color: '#999', fontSize: 14 },
  infoValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  link: { marginTop: 4, paddingVertical: 10 },
  linkText: { color: '#64C4FF', fontSize: 14, fontWeight: '600' },
  driversTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  driverRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#191919' },
  driverDot: { width: 8, height: 20, borderRadius: 2, marginRight: 12 },
  driverName: { color: '#fff', fontSize: 15, flex: 1 },
  driverPts: { color: '#bbb', fontSize: 14, fontWeight: '700' },
});
