import type { StressLevel } from "@/lib/stress/config";

export interface SessionLogEntry {
  /** ms, relative to performance.now() at time of sampling */
  t: number;
  level: StressLevel;
}

export interface StressBurst {
  level: StressLevel;
  startT: number;
  endT: number;
  durationMs: number;
  /** number of consecutive samples in this run */
  sampleCount: number;
}

/** Groups a time-ordered session log into contiguous same-level runs ("bursts"). */
export function computeBursts(log: SessionLogEntry[], sampleSpacingMs: number): StressBurst[] {
  if (log.length === 0) return [];

  const bursts: StressBurst[] = [];
  let runStart = log[0].t;
  let runLevel = log[0].level;
  let runCount = 1;
  let lastT = log[0].t;

  for (let i = 1; i < log.length; i++) {
    const entry = log[i];
    if (entry.level === runLevel) {
      runCount += 1;
      lastT = entry.t;
      continue;
    }
    bursts.push({
      level: runLevel,
      startT: runStart,
      endT: lastT + sampleSpacingMs,
      durationMs: lastT + sampleSpacingMs - runStart,
      sampleCount: runCount,
    });
    runStart = entry.t;
    runLevel = entry.level;
    runCount = 1;
    lastT = entry.t;
  }

  bursts.push({
    level: runLevel,
    startT: runStart,
    endT: lastT + sampleSpacingMs,
    durationMs: lastT + sampleSpacingMs - runStart,
    sampleCount: runCount,
  });

  return bursts;
}

/** The single longest contiguous run for a given level, or null if that level never occurred. */
export function longestBurstForLevel(bursts: StressBurst[], level: StressLevel): StressBurst | null {
  const matches = bursts.filter((b) => b.level === level);
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (b.durationMs > a.durationMs ? b : a));
}
