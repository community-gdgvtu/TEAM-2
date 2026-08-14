import type { HrvFeatures } from "@/lib/hrv/features";
import { STRESS_BOUNDARIES, type StressLevel } from "./config";

/** Hardcoded-boundary stress classifier: RMSSD -> calm / neutral / elevated. */
export function classifyStress(features: HrvFeatures): StressLevel {
  if (features.rmssdMs >= STRESS_BOUNDARIES.rmssdCalmMs) return "calm";
  if (features.rmssdMs < STRESS_BOUNDARIES.rmssdElevatedMs) return "elevated";
  return "neutral";
}

export const STRESS_COPY: Record<StressLevel, { label: string; emoji: string; parentNote: string }> = {
  calm: {
    label: "Calm",
    emoji: "😌",
    parentNote: "Heart-rate variability was in a relaxed range for this child.",
  },
  neutral: {
    label: "Engaged",
    emoji: "🙂",
    parentNote: "Heart-rate variability was in a typical, moderately-aroused range.",
  },
  elevated: {
    label: "Elevated",
    emoji: "😳",
    parentNote: "Heart-rate variability dropped, consistent with excitement or stress arousal.",
  },
};
