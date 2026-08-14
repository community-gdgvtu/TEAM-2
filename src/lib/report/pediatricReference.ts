/**
 * General pediatric resting-heart-rate reference ranges by age band.
 *
 * These are broad, widely-cited "normal awake resting HR" ranges from general
 * pediatric vital-sign references (e.g. PALS-style tables) — NOT derived from
 * this app, this game, or any specific study of children playing it. They exist
 * only to give a parent a rough, honest point of comparison for their child's
 * measured resting HR from the pre-game calibration. Treat as illustrative
 * general knowledge, not a clinical or research-grade norm.
 */
export interface AgeReferenceRange {
  minAge: number;
  maxAge: number;
  restingHrLowBpm: number;
  restingHrHighBpm: number;
}

const REFERENCE_RANGES: AgeReferenceRange[] = [
  { minAge: 3, maxAge: 4, restingHrLowBpm: 80, restingHrHighBpm: 120 },
  { minAge: 5, maxAge: 6, restingHrLowBpm: 75, restingHrHighBpm: 115 },
  { minAge: 7, maxAge: 9, restingHrLowBpm: 70, restingHrHighBpm: 110 },
  { minAge: 10, maxAge: 12, restingHrLowBpm: 60, restingHrHighBpm: 100 },
];

export function getAgeReferenceRange(age: number): AgeReferenceRange | null {
  return REFERENCE_RANGES.find((r) => age >= r.minAge && age <= r.maxAge) ?? null;
}
