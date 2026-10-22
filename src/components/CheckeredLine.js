import React from 'react';
import { View, StyleSheet } from 'react-native';

// A thin checkered-flag divider: two rows of alternating black/white squares.
export default function CheckeredLine({ square = 9, cols = 40 }) {
  const rows = [0, 1];
  return (
    <View style={styles.wrap}>
      {rows.map((r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: cols }).map((_, c) => (
            <View
              key={c}
              style={{
                width: square,
                height: square,
                backgroundColor: (r + c) % 2 === 0 ? '#f0f0f0' : '#111',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, borderRadius: 4, overflow: 'hidden' },
  row: { flexDirection: 'row' },
});
