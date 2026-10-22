import React from 'react';
import { View, Text, ScrollView, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { INSTAGRAM_URL, CONTACT_EMAIL } from '../config';

const APP_VERSION = '1.0.0';

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function AboutScreen() {
  const version = APP_VERSION;
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.logo}>GRIDLINE</Text>
      <Text style={styles.by}>Created by Hisham · Free</Text>

      <Text style={styles.h2}>App</Text>
      <Row label="Version" value={version} />
      <Row label="Platform" value="Android (Expo)" />

      <Text style={styles.h2}>Contact</Text>
      <TouchableOpacity onPress={() => Linking.openURL(INSTAGRAM_URL)}>
        <Row label="Instagram" value="@worldofhisham ›" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
        <Row label="Email" value={`${CONTACT_EMAIL} ›`} />
      </TouchableOpacity>

      <Text style={styles.h2}>Data sources</Text>
      <TouchableOpacity onPress={() => Linking.openURL('https://api.jolpi.ca')}>
        <Row label="Schedule, standings & results" value="Jolpica ›" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL('https://open-meteo.com')}>
        <Row label="Track weather" value="Open-Meteo ›" />
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        This app is an independent, free fan project. It is not affiliated with,
        endorsed by, or associated with Formula 1, the FIA, Formula One Management,
        or any team. All trademarks belong to their respective owners. Schedule,
        standings and results come from Jolpica and weather from Open-Meteo;
        please see their terms.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 24, paddingTop: 56, paddingBottom: 90 },
  logo: { color: '#E8002D', fontSize: 34, fontWeight: '900', letterSpacing: 2 },
  by: { color: '#aaa', marginTop: 4, marginBottom: 10 },
  h2: { color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 24, marginBottom: 6 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#191919',
  },
  label: { color: '#bbb', fontSize: 14 },
  value: { color: '#fff', fontSize: 14, fontWeight: '600' },
  disclaimer: { color: '#666', fontSize: 12, lineHeight: 18, marginTop: 24 },
});
