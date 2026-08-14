/**
 * Hardcoded stress-classification boundaries.
 *
 * These are illustrative heuristic cutoffs (rooted in the general HRV literature:
 * lower RMSSD ~ lower vagal/parasympathetic activity ~ higher sympathetic
 * arousal), NOT medically validated per-child thresholds. Swap these for a
 * learned/calibrated model later — for now they're intentionally simple
 * constants so the rest of the pipeline has something concrete to react to.
 */
export const STRESS_BOUNDARIES = {
  /** RMSSD (ms) at/above this -> "calm" */
  rmssdCalmMs: 40,
  /** RMSSD (ms) below this -> "elevated" */
  rmssdElevatedMs: 20,
} as const;

export const BASELINE_CONFIG = {
  /** how long the pre-game calibration screen collects a personal baseline, ms */
  calibrationDurationMs: 20_000,
  /**
   * Upper bound before giving up and showing the retry message. Must exceed
   * calibrationDurationMs: the ONNX engine's first reading isn't just "collected"
   * at the 20s mark, it still has to run a multi-second model forward pass after
   * the clip buffer fills, so the nominal 20s window alone isn't enough time.
   */
  calibrationMaxWaitMs: 60_000,
  /** minimum beats required for the baseline to be considered valid */
  minBeatsForBaseline: 8,
} as const;

export const DEVIATION_CONFIG = {
  /** rolling window used to compute a "live" RMSSD sample during gameplay, ms */
  windowMs: 5_000,
  /** how far (in std-devs from personal baseline) counts as a deviation */
  deviationStdMultiplier: 1.5,
  /** floor for baseline std-dev, so a suspiciously flat calibration doesn't make the detector hair-triggered */
  minBaselineStdMs: 4,
  /** consecutive deviating windows required before flagging a "persistent" deviation */
  persistenceWindows: 3,
} as const;

export type StressLevel = "calm" | "neutral" | "elevated";
