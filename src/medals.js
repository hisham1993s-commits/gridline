// Podium medal emoji for finishing positions.
export function medal(pos) {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return '';
}

// Is the championship mathematically decided (or the season over)?
// gap = leaderPoints - runnerUpPoints; roundsLeft = rounds still to run;
// perRound = max points the runner-up could out-score the leader by per round.
export function isChampion(gap, roundsLeft, perRound) {
  if (roundsLeft <= 0) return true;        // season finished → leader is champion
  return gap > roundsLeft * perRound;       // clinched early
}

// Conservative per-round swing caps (race + sprint), so we never crown too early.
export const DRIVER_PER_ROUND = 33;   // 25 (win) + 8 (sprint win)
export const TEAM_PER_ROUND = 58;     // 1st+2nd (43) + sprint 1st+2nd (15)
