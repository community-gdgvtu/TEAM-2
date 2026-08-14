export interface Child {
  id: number;
  name: string;
  age: number;
  created_at: string;
  has_baseline: boolean;
  session_count: number;
}

export interface PhysioFeatures {
  mean_hr?: number | null;
  hrv_sdnn?: number | null;
  hrv_lf?: number | null;
  hrv_hf?: number | null;
  signal_quality?: number;
}

export interface GazeFeatures {
  blink_rate: number;
  gaze_stability: number;
  head_movement: number;
  attention_score: number;
}

export interface GameFeatures {
  avg_reaction_time_ms: number;
  reaction_time_std: number;
  error_rate: number;
  retry_rate: number;
  hesitation_count: number;
  total_events: number;
  score: number;
}

export interface SessionFeatures {
  physio: PhysioFeatures;
  gaze: GazeFeatures;
  game: GameFeatures;
}

export interface WellnessSignal {
  id: number;
  session_id: number;
  child_id: number;
  deviation_score: number;
  risk_level: 'normal' | 'watch' | 'elevated';
  flagged: boolean;
  feature_deviations: Record<string, number>;
  explanation: string;
  shap_values: Record<string, number>;
  created_at: string;
}

export interface SessionResult {
  id: number;
  child_id: number;
  session_type: string;
  started_at: string;
  duration_sec: number;
  features: SessionFeatures;
  wellness_signal?: WellnessSignal | null;
}

export interface DashboardSummary {
  child: Child;
  baseline_ready: boolean;
  total_sessions: number;
  recent_signals: WellnessSignal[];
  prs_summary: Record<string, unknown>;
  trend: Array<{
    session_id: number;
    date: string;
    deviation_score: number;
    risk_level: string;
    flagged: boolean;
  }>;
}

export interface RGBSignal {
  timestamps: number[];
  red: number[];
  green: number[];
  blue: number[];
  fps: number;
}

export interface GameEvent {
  type: 'hit' | 'miss' | 'hesitation';
  reaction_ms?: number;
  timestamp: number;
}
