/**
 * Pure helpers for the PeerTemp temperature engine.
 * Anything that mutates temperature must go through `logTemperatureEvent`,
 * which uses these helpers internally.
 */

export const TEMP_FLOOR = 35.0;
export const TEMP_CEILING = 40.0;
export const TEMP_BASELINE = 36.5;

/** Default per-event Δ caps so a single event cannot drive drama spikes. */
export const MAX_SINGLE_EVENT_DELTA = 0.5;

/** Default scoring weights used by `computeMetrics`. Override per org. */
export const DEFAULT_WEIGHTS = {
  responseTime: 0.2,
  participationVolume: 0.15,
  taskCompletion: 0.2,
  professionalism: 0.1,
  platformContribution: 0.15,
  leaderEvaluation: 0.1,
  peerEvaluation: 0.1,
} as const;

/** Default label thresholds (overridable per org). */
export const DEFAULT_THRESHOLDS = {
  outstanding: 0.85,
  strong: 0.7,
  stable: 0.55,
  at_risk: 0.4,
} as const;

export type PerformanceLabel =
  | "outstanding"
  | "strong"
  | "stable"
  | "at_risk"
  | "critical";

export function clampTemperature(
  value: number,
  floor = TEMP_FLOOR,
  ceiling = TEMP_CEILING,
): number {
  if (Number.isNaN(value)) return TEMP_BASELINE;
  return Math.max(floor, Math.min(ceiling, value));
}

export function capDelta(delta: number, max = MAX_SINGLE_EVENT_DELTA): number {
  if (delta > max) return max;
  if (delta < -max) return -max;
  return delta;
}

export function labelFromScore(
  score: number,
  thresholds: Partial<typeof DEFAULT_THRESHOLDS> = {},
): PerformanceLabel {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  if (score >= t.outstanding) return "outstanding";
  if (score >= t.strong) return "strong";
  if (score >= t.stable) return "stable";
  if (score >= t.at_risk) return "at_risk";
  return "critical";
}

/** Parse "owner/repo" or a github URL into { owner, repo }. */
export function parseGithubRepo(
  input: string,
): { owner: string; repo: string } | null {
  if (!input) return null;
  const direct = input.match(/^([^\/\s]+)\/([^\/\s]+?)(?:\.git)?$/);
  if (direct) return { owner: direct[1], repo: direct[2] };
  const url = input.match(
    /github\.com\/([^\/\s]+)\/([^\/\s?#]+?)(?:\.git)?(?:[\/?#]|$)/,
  );
  if (url) return { owner: url[1], repo: url[2] };
  return null;
}
