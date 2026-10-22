import { Dimensions } from 'react-native';

// Responsive font scaling: sizes are tuned for a ~390dp wide phone and scale
// proportionally to the device width, clamped so they never get too small or
// too large. Computed once at launch from the device width, so every Android
// phone gets fonts that fit its screen.
const { width } = Dimensions.get('window');
const scale = Math.min(Math.max(width / 390, 0.84), 1.12);

export function rf(size) {
  return Math.round(size * scale);
}

export const SCREEN_WIDTH = width;
