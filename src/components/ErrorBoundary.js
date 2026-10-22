import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Catches render/runtime crashes anywhere below it. Instead of leaving the app
// frozen on a blank/white screen, it briefly shows a recovery message and then
// automatically remounts the whole tree (a self-restart).
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false, key: 0 };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error) {
    // Auto-restart after a short beat.
    this.timer = setTimeout(() => {
      this.setState((s) => ({ crashed: false, key: s.key + 1 }));
    }, 1200);
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  render() {
    if (this.state.crashed) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Restarting…</Text>
          <Text style={styles.sub}>The app hit a snag and is recovering.</Text>
        </View>
      );
    }
    // Changing the key forces a fresh mount of the subtree on restart.
    return <React.Fragment key={this.state.key}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#E8002D', fontSize: 22, fontWeight: '800' },
  sub: { color: '#999', marginTop: 8, textAlign: 'center' },
});
