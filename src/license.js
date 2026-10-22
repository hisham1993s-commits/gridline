// ---------------------------------------------------------------------------
// Free version: the app has no trial, paywall, unlock codes or payment links.
// Every feature is available to everyone. These stubs keep the old call sites
// working without any gating.
// ---------------------------------------------------------------------------

export const TRIAL_DAYS = 0;

export async function ensureFirstLaunch() {}

export async function isUnlocked() { return true; }

export async function isLocked() { return false; }

export async function daysLeft() { return Infinity; }

// Infinity = no trial to show (the UI hides the countdown when it isn't finite).
export async function msLeft() { return Infinity; }

export function isValidCode() { return true; }

export async function unlockWithCode() { return { ok: true, reason: '' }; }
