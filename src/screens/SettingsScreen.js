import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity, BackHandler, Modal, TextInput,
} from 'react-native';
import {
  getDelaySec, setDelaySec, getNoSpoiler, setNoSpoiler, getApiToken, setApiToken,
} from '../settings';
import { getNotifyEnabled, setNotifyEnabled } from '../notifications';
import { useI18n, LANGUAGES } from '../i18n';
import AboutScreen from './AboutScreen';

export default function SettingsScreen() {
  const { t, lang, setLang } = useI18n();
  const [delay, setDelay] = useState(0);
  const [noSpoiler, setNS] = useState(false);
  const [notify, setNotify] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    getDelaySec().then(setDelay);
    getNoSpoiler().then(setNS);
    getNotifyEnabled().then(setNotify);
    getApiToken().then(setToken);
  }, []);

  // Android back closes the About sub-view first.
  useEffect(() => {
    if (!showAbout) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setShowAbout(false); return true; });
    return () => sub.remove();
  }, [showAbout]);

  async function changeDelay(next) {
    const v = Math.max(0, Math.min(120, next));
    setDelay(v);
    await setDelaySec(v);
  }
  async function toggleNS(v) { setNS(v); await setNoSpoiler(v); }
  async function toggleNotify(v) { setNotify(v); await setNotifyEnabled(v); }

  if (showAbout) {
    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity style={styles.back} onPress={() => setShowAbout(false)}>
          <Text style={styles.backText}>‹ {t('settings')}</Text>
        </TouchableOpacity>
        <AboutScreen />
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{t('settings')}</Text>

      <Text style={styles.section}>{t('language')}</Text>
      <TouchableOpacity style={styles.card} onPress={() => setLangOpen(true)}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>{LANGUAGES.find((l) => l.code === lang)?.label || 'English'}</Text>
          <Text style={styles.chev}>▾</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setLangOpen(false)}>
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>{t('language')}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {LANGUAGES.map((l) => {
                const on = l.code === lang;
                return (
                  <TouchableOpacity
                    key={l.code}
                    style={[styles.pickerRow, on && styles.pickerRowOn]}
                    onPress={() => { setLang(l.code); setLangOpen(false); }}
                  >
                    <Text style={[styles.pickerText, on && styles.pickerTextOn]}>{l.label}</Text>
                    {on && <Text style={styles.pickerCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Text style={styles.section}>{t('liveFeed')}</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.label}>{t('noSpoilerMode')}</Text>
            <Text style={styles.hint}>{t('noSpoilerHint')}</Text>
          </View>
          <Switch value={noSpoiler} onValueChange={toggleNS}
            trackColor={{ true: '#E8002D', false: '#333' }} thumbColor="#fff" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('tvDelay')}</Text>
        <Text style={styles.hint}>{t('tvDelayHint')}</Text>
        <View style={styles.stepper}>
          <TouchableOpacity style={styles.step} onPress={() => changeDelay(delay - 5)}>
            <Text style={styles.stepText}>−5s</Text>
          </TouchableOpacity>
          <Text style={styles.delayValue}>{delay}s</Text>
          <TouchableOpacity style={styles.step} onPress={() => changeDelay(delay + 5)}>
            <Text style={styles.stepText}>+5s</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.section}>{t('notifications')}</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.label}>{t('notifyLive')}</Text>
            <Text style={styles.hint}>{t('notifyHint')}</Text>
          </View>
          <Switch value={notify} onValueChange={toggleNotify}
            trackColor={{ true: '#E8002D', false: '#333' }} thumbColor="#fff" />
        </View>
      </View>

      <Text style={styles.section}>LIVE DATA</Text>
      <View style={styles.card}>
        <Text style={styles.label}>OpenF1 sponsor token</Text>
        <Text style={styles.hint}>
          Paste your own token from openf1.org to make the live session view
          real-time. Leave empty to use the free last-session replay.
        </Text>
        <TextInput
          style={styles.input}
          value={token}
          onChangeText={setToken}
          onEndEditing={() => setApiToken(token)}
          placeholder="paste token (optional)"
          placeholderTextColor="#666"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        {!!token && (
          <TouchableOpacity onPress={() => { setToken(''); setApiToken(''); }}>
            <Text style={styles.clearToken}>Clear token</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.section}>{t('info')}</Text>
      <TouchableOpacity style={styles.card} onPress={() => setShowAbout(true)}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>{t('about')}</Text>
          <Text style={styles.chev}>›</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 90 },
  h1: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 16 },
  section: { color: '#777', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 14, marginBottom: 8 },
  card: { backgroundColor: '#161616', borderRadius: 12, padding: 16, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: '#fff', fontSize: 16, fontWeight: '600' },
  hint: { color: '#999', fontSize: 13, marginTop: 4, lineHeight: 18 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  step: { backgroundColor: '#262626', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  stepText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  delayValue: { color: '#fff', fontSize: 22, fontWeight: '800' },
  chev: { color: '#777', fontSize: 22 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 28 },
  pickerBox: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 8, borderWidth: 1, borderColor: '#333' },
  pickerTitle: { color: '#fff', fontSize: 16, fontWeight: '800', padding: 12 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 10 },
  pickerRowOn: { backgroundColor: '#2a1012' },
  pickerText: { color: '#ddd', fontSize: 16 },
  pickerTextOn: { color: '#fff', fontWeight: '700' },
  pickerCheck: { color: '#E8002D', fontSize: 16, fontWeight: '800' },
  input: { backgroundColor: '#0d0d0d', color: '#fff', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#2a2a2a', fontSize: 14 },
  clearToken: { color: '#ff6b6b', fontSize: 13, fontWeight: '700', marginTop: 10 },
  langWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: { backgroundColor: '#262626', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  langChipOn: { backgroundColor: '#E8002D' },
  langText: { color: '#ccc', fontWeight: '600', fontSize: 14 },
  langTextOn: { color: '#fff' },
  back: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 6, backgroundColor: '#0d0d0d' },
  backText: { color: '#E8002D', fontSize: 16, fontWeight: '700' },
});
