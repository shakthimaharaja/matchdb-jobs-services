/* =============================================================================
 * matchdb-jobs-services — Centralized constants
 * Single source of truth for business limits, thresholds, and config.
 * ============================================================================= */

// ─── Plan-Based Limits ─────────────────────────────────────────────────────────

export const JOB_POSTING_LIMITS: Record<string, number> = {
  free: 0,
  basic: 5,
  pro: 10,
  pro_plus: 20,
  enterprise: Infinity,
};

export const POKE_LIMITS: Record<string, number> = {
  free: 5,
  basic: 25,
  pro: 50,
  pro_plus: Infinity,
  enterprise: Infinity,
};

// ─── WebSocket Config ──────────────────────────────────────────────────────────

export const WS_BROADCAST_INTERVAL_MS = 30_000;
export const WS_MAX_ROWS = 25;

// ─── External URLs ─────────────────────────────────────────────────────────────

export const GOOGLE_MEET_BASE = "https://meet.google.com";

// ─── Email Theme ───────────────────────────────────────────────────────────────

export const EMAIL_COLORS = {
  primary: "#1d4479",
  primaryLight: "#3b6fa6",
  accent: "#a8cbf5",
  googleBlue: "#1a73e8",
  highlight: "#f0f4f8",
  text: "#444",
  textDark: "#333",
  muted: "#888",
  border: "#e0e0e0",
  white: "#ffffff",
} as const;
