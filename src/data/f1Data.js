// Fallback circuit outline, used by TrackMap until the real layout loads.

// A simple closed track outline (normalised 0..100 coordinates).
// Swap these points for the real circuit layout whenever you like.
export const TRACK = {
  name: 'Sample Circuit',
  // Path points tracing a loop.
  points: [
    [12, 70], [12, 40], [22, 22], [40, 18], [52, 26],
    [58, 40], [72, 42], [86, 30], [90, 50], [78, 64],
    [60, 66], [48, 58], [38, 64], [30, 80], [18, 82],
  ],
  // Where the start/finish line sits (index into points).
  startIndex: 0,
};
