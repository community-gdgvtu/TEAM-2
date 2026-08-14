import type { SessionLogEntry, StressBurst } from "@/lib/report/analytics";
import type { StressLevel } from "@/lib/stress/config";

// Status palette (reserved role colors — never reused for identity/series):
// calm -> good, neutral -> warning, elevated -> critical.
const STATUS_COLOR: Record<StressLevel, string> = {
  calm: "#0ca30c",
  neutral: "#fab219",
  elevated: "#d03b3b",
};
const LEVEL_Y: Record<StressLevel, number> = { calm: 0, neutral: 1, elevated: 2 };
const LEVEL_LABEL: Record<StressLevel, string> = { calm: "Calm", neutral: "Neutral", elevated: "Elevated" };

const WIDTH = 600;
const HEIGHT = 160;
const PAD_LEFT = 64;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const PLOT_W = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM;

interface StressTimelineChartProps {
  log: SessionLogEntry[];
  sessionStartT: number;
  sessionEndT: number;
  elevatedBursts: StressBurst[];
}

export default function StressTimelineChart({ log, sessionStartT, sessionEndT, elevatedBursts }: StressTimelineChartProps) {
  const durationMs = Math.max(1, sessionEndT - sessionStartT);
  const xFor = (t: number) => PAD_LEFT + ((t - sessionStartT) / durationMs) * PLOT_W;
  const yFor = (level: StressLevel) => PAD_TOP + PLOT_H - (LEVEL_Y[level] / 2) * PLOT_H;

  if (log.length === 0) {
    return <p className="text-sm text-slate-400">Not enough readings during play to chart a timeline.</p>;
  }

  const linePoints = log.map((e) => `${xFor(e.t).toFixed(1)},${yFor(e.level).toFixed(1)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Stress level over the course of the game">
        {/* elevated-burst background wash ("stress bursts") */}
        {elevatedBursts.map((b, i) => (
          <rect
            key={i}
            x={xFor(b.startT)}
            y={PAD_TOP}
            width={Math.max(1, xFor(b.endT) - xFor(b.startT))}
            height={PLOT_H}
            fill={STATUS_COLOR.elevated}
            opacity={0.1}
          />
        ))}

        {/* gridlines + y labels, one per ordinal band */}
        {(["elevated", "neutral", "calm"] as StressLevel[]).map((lvl) => (
          <g key={lvl}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yFor(lvl)} y2={yFor(lvl)} stroke="#e1e0d9" strokeWidth={1} />
            <text x={PAD_LEFT - 8} y={yFor(lvl)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#898781">
              {LEVEL_LABEL[lvl]}
            </text>
          </g>
        ))}

        {/* baseline axis */}
        <line
          x1={PAD_LEFT}
          x2={WIDTH - PAD_RIGHT}
          y1={PAD_TOP + PLOT_H}
          y2={PAD_TOP + PLOT_H}
          stroke="#c3c2b7"
          strokeWidth={1}
        />

        {/* trend line */}
        <polyline points={linePoints} fill="none" stroke="#52514e" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* markers, colored by status */}
        {log.map((e, i) => (
          <circle key={i} cx={xFor(e.t)} cy={yFor(e.level)} r={4} fill={STATUS_COLOR[e.level]} stroke="#ffffff" strokeWidth={2}>
            <title>
              {`${Math.round((e.t - sessionStartT) / 1000)}s — ${LEVEL_LABEL[e.level]}`}
            </title>
          </circle>
        ))}

        {/* x-axis endpoints */}
        <text x={PAD_LEFT} y={HEIGHT - 8} fontSize={11} fill="#898781">
          0:00
        </text>
        <text x={WIDTH - PAD_RIGHT} y={HEIGHT - 8} textAnchor="end" fontSize={11} fill="#898781">
          {formatMmSs(durationMs)}
        </text>
      </svg>

      <div className="mt-2 flex justify-center gap-4 text-xs text-slate-500">
        {(["calm", "neutral", "elevated"] as StressLevel[]).map((lvl) => (
          <span key={lvl} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[lvl] }} />
            {LEVEL_LABEL[lvl]}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatMmSs(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
