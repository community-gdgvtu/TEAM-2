"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import CatchGame from "@/components/CatchGame";
import StressTimelineChart from "@/components/StressTimelineChart";
import { computeBaseline, DeviationTracker, type DeviationEvent, type PersonalBaseline } from "@/lib/stress/baseline";
import { computeHrvFeatures } from "@/lib/hrv/features";
import { classifyStress, STRESS_COPY } from "@/lib/stress/classify";
import { BASELINE_CONFIG, DEVIATION_CONFIG, type StressLevel } from "@/lib/stress/config";
import { computeBursts, longestBurstForLevel, type SessionLogEntry } from "@/lib/report/analytics";
import { getAgeReferenceRange } from "@/lib/report/pediatricReference";
import type { Roi, RppgEngine } from "@/lib/rppg/types";

type Stage = "intro" | "camera" | "calibrating" | "playing" | "report";

interface ReportSnapshot {
  levelCounts: Record<StressLevel, number>;
  totalLogs: number;
  deviationEvents: DeviationEvent[];
  log: SessionLogEntry[];
  sessionStartT: number;
  sessionEndT: number;
}

const EMPTY_REPORT: ReportSnapshot = {
  levelCounts: { calm: 0, neutral: 0, elevated: 0 },
  totalLogs: 1,
  deviationEvents: [],
  log: [],
  sessionStartT: 0,
  sessionEndT: 1,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AGE_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 3); // 3..12

function randomAddend() {
  return Math.floor(2 + Math.random() * 6);
}

export interface PlaySessionProps {
  /** which pulse-extraction engine drives this session (POS signal-processing vs ONNX model) */
  useEngine: () => RppgEngine;
  /** short badge shown on the intro screen, e.g. "Classic" or "AI Model (ONNX)" */
  engineBadge: string;
  /** extra sentence describing this engine's behavior/tradeoffs */
  engineNote: string;
}

export default function PlaySession({ useEngine, engineBadge, engineNote }: PlaySessionProps) {
  const { videoRef, status, snapshot, start, getBeatsSince, roi, modelStatus, modelError } = useEngine();

  const [stage, setStage] = useState<Stage>("intro");
  const [consent, setConsent] = useState(false);
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState<number | "">("");
  const [parentEmail, setParentEmail] = useState("");
  const [calibProgress, setCalibProgress] = useState(0);
  const [baseline, setBaseline] = useState<PersonalBaseline | null>(null);
  const [calibMessage, setCalibMessage] = useState<string | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  const [gateAnswer, setGateAnswer] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  const [gateNums, setGateNums] = useState<[number, number]>(() => [randomAddend(), randomAddend()]);
  const [report, setReport] = useState<ReportSnapshot>(EMPTY_REPORT);

  const calibStartRef = useRef(0);
  const trackerRef = useRef<DeviationTracker | null>(null);
  const deviationEventsRef = useRef<DeviationEvent[]>([]);
  const sessionLogRef = useRef<SessionLogEntry[]>([]);
  const playStartRef = useRef(0);

  const profileValid = childName.trim().length > 0 && childAge !== "" && EMAIL_RE.test(parentEmail.trim());

  const beginCamera = useCallback(async () => {
    setStage("camera");
    const result = await start();
    if (result === "ready") {
      calibStartRef.current = performance.now();
      setCalibProgress(0);
      setCalibMessage(null);
      setStage("calibrating");
    }
  }, [start]);

  // calibration countdown + baseline capture.
  //
  // The nominal window (calibrationDurationMs) is when we *start* checking for
  // a valid baseline, not a hard deadline: the ONNX engine's first reading needs
  // the full 20s just to fill its clip buffer, then several more seconds for the
  // model's forward pass to actually finish, so beats often aren't ready right
  // at the 20s mark even with a perfectly good signal. Keep polling past that
  // point — showing an "analyzing" state — up to calibrationMaxWaitMs before
  // giving up and showing the retry message.
  useEffect(() => {
    if (stage !== "calibrating") return;
    const id = setInterval(() => {
      const elapsed = performance.now() - calibStartRef.current;
      const pct = Math.min(1, elapsed / BASELINE_CONFIG.calibrationDurationMs);
      setCalibProgress(pct);

      if (elapsed < BASELINE_CONFIG.calibrationDurationMs) return;

      const beats = getBeatsSince(BASELINE_CONFIG.calibrationDurationMs);
      const b = computeBaseline(beats);
      if (b) {
        clearInterval(id);
        setBaseline(b);
        trackerRef.current = new DeviationTracker(b);
        deviationEventsRef.current = [];
        sessionLogRef.current = [];
        playStartRef.current = performance.now();
        setStage("playing");
        return;
      }

      if (elapsed >= BASELINE_CONFIG.calibrationMaxWaitMs) {
        clearInterval(id);
        setCalibMessage(
          "We couldn't get a clear reading. Make sure your face is inside the guide, the room has good light, then try again."
        );
      }
    }, 200);
    return () => clearInterval(id);
  }, [stage, getBeatsSince]);

  const retryCalibration = useCallback(() => {
    calibStartRef.current = performance.now();
    setCalibProgress(0);
    setCalibMessage(null);
  }, []);

  // background HRV sampling during gameplay -> deviation tracking + session log
  useEffect(() => {
    if (stage !== "playing") return;
    const id = setInterval(() => {
      const now = performance.now();
      const beats = getBeatsSince(DEVIATION_CONFIG.windowMs);
      const features = computeHrvFeatures(beats, 4);
      if (features) {
        sessionLogRef.current.push({ t: now, level: classifyStress(features) });
      }
      if (trackerRef.current) {
        const event = trackerRef.current.ingestWindow(now, beats);
        if (event) deviationEventsRef.current.push(event);
      }
    }, DEVIATION_CONFIG.windowMs);
    return () => clearInterval(id);
  }, [stage, getBeatsSince]);

  const handleGameOver = useCallback((score: number) => {
    const log = sessionLogRef.current.slice();
    const levelCounts = log.reduce(
      (acc, e) => {
        acc[e.level] += 1;
        return acc;
      },
      { calm: 0, neutral: 0, elevated: 0 } as Record<StressLevel, number>
    );
    setReport({
      levelCounts,
      totalLogs: log.length || 1,
      deviationEvents: deviationEventsRef.current.slice(),
      log,
      sessionStartT: playStartRef.current,
      sessionEndT: performance.now(),
    });
    setFinalScore(score);
    setGateNums([randomAddend(), randomAddend()]);
    setGateOpen(false);
    setGateAnswer("");
    setStage("report");
  }, []);

  const playAgain = useCallback(() => {
    setStage("calibrating");
    calibStartRef.current = performance.now();
    setCalibProgress(0);
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center gap-6 px-4 py-8">
      <Link href="/" className="self-start text-sm text-slate-500 hover:underline">
        ← Back home
      </Link>

      {stage === "intro" && (
        <section className="w-full rounded-3xl bg-white p-8 text-center shadow-lg">
          <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
            {engineBadge}
          </span>
          <h1 className="mt-3 text-3xl font-extrabold text-emerald-700">Catch the Pets! 🐾</h1>
          <p className="mt-3 text-slate-600">
            This game uses your camera to gently watch your heartbeat while you play — no video is ever
            recorded or sent anywhere, everything happens right here in your browser.
          </p>
          <p className="mt-2 text-sm text-slate-500">{engineNote}</p>

          <div className="mx-auto mt-6 max-w-xs space-y-3 text-left">
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
              For grown-ups, before we start
            </p>
            <label className="block text-sm text-slate-600">
              Child&apos;s name
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="e.g. Maya"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-slate-800"
              />
            </label>
            <label className="block text-sm text-slate-600">
              Child&apos;s age
              <select
                value={childAge}
                onChange={(e) => setChildAge(e.target.value ? Number(e.target.value) : "")}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-slate-800"
              >
                <option value="">Select age…</option>
                {AGE_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a} years old
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-600">
              Your email (for the report)
              <input
                type="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-slate-800"
              />
            </label>
          </div>

          <label className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="h-5 w-5"
            />
            A grown-up says it&apos;s okay to turn on the camera
          </label>
          <button
            disabled={!consent || !profileValid}
            onClick={beginCamera}
            className="mt-6 rounded-full bg-emerald-500 px-8 py-3 text-lg font-bold text-white shadow disabled:cursor-not-allowed disabled:opacity-40 hover:bg-emerald-600"
          >
            Let&apos;s Play!
          </button>
        </section>
      )}

      {stage === "camera" && status === "requesting" && (
        <section className="w-full rounded-3xl bg-white p-8 text-center shadow-lg">
          <p className="text-lg">Asking for camera permission… please click &quot;Allow&quot; 📷</p>
        </section>
      )}

      {status === "denied" && stage !== "intro" && (
        <section className="w-full rounded-3xl bg-white p-8 text-center shadow-lg">
          <p className="text-lg text-rose-600">
            Camera access was blocked. Please allow camera permission in your browser settings and try again.
          </p>
          <button onClick={beginCamera} className="mt-4 rounded-full bg-emerald-500 px-6 py-2 font-bold text-white">
            Try Again
          </button>
        </section>
      )}

      {/* Kept mounted for the whole page lifetime (not conditionally) so the ref exists
          before start() is called; hidden off-screen since the sampler reads pixels directly. */}
      <video ref={videoRef} muted playsInline aria-hidden className="pointer-events-none fixed left-0 top-0 h-1 w-1 opacity-0" />

      {stage === "calibrating" && (
        <section className="w-full rounded-3xl bg-white p-8 text-center shadow-lg">
          <h2 className="text-2xl font-bold text-emerald-700">Getting Ready…</h2>
          <p className="mt-2 text-slate-600">Hold still and look at the circle for a few seconds 🙂</p>
          <div className="relative mx-auto mt-6 flex h-56 w-56 items-center justify-center">
            <CameraPreview videoRef={videoRef} roi={roi} />
          </div>
          <p className="mt-3 text-sm text-slate-500">
            {snapshot.heartRateBpm ? `❤️ ${Math.round(snapshot.heartRateBpm)} bpm` : "📡 finding your pulse…"}
          </p>
          {modelStatus === "loading" && (
            <p className="mt-1 text-xs text-slate-400">Loading the AI model… (first time only, a few MB)</p>
          )}
          {modelStatus === "error" && (
            <p className="mt-1 text-xs text-rose-500">Model failed to load{modelError ? `: ${modelError}` : ""}.</p>
          )}
          <div className="mx-auto mt-6 h-3 w-full max-w-sm overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.round(calibProgress * 100)}%` }}
            />
          </div>
          {calibProgress >= 1 && !calibMessage && (
            <p className="mt-2 text-xs text-slate-400">Analyzing… this can take a little longer for the AI model.</p>
          )}
          {calibMessage && (
            <div className="mt-4">
              <p className="text-rose-600">{calibMessage}</p>
              <button onClick={retryCalibration} className="mt-3 rounded-full bg-emerald-500 px-6 py-2 font-bold text-white">
                Try Again
              </button>
            </div>
          )}
        </section>
      )}

      {stage === "playing" && (
        <section className="w-full">
          <CatchGame running={stage === "playing"} onGameOver={handleGameOver} />
        </section>
      )}

      {stage === "report" && (
        <section className="w-full rounded-3xl bg-white p-8 shadow-lg">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-emerald-700">Nice job!</h2>
            <p className="mt-1 text-xl">You caught {finalScore} pets 🎉</p>
            <button onClick={playAgain} className="mt-4 rounded-full bg-emerald-500 px-6 py-2 font-bold text-white">
              Play Again
            </button>
          </div>

          <div className="mt-8 border-t pt-6">
            {!gateOpen ? (
              <div className="mx-auto max-w-xs text-center">
                <p className="text-sm font-semibold text-slate-500">For grown-ups</p>
                <p className="mt-1 text-sm text-slate-500">
                  Answer this to see the wellness report: what is {gateNums[0]} + {gateNums[1]}?
                </p>
                <div className="mt-3 flex justify-center gap-2">
                  <input
                    type="number"
                    value={gateAnswer}
                    onChange={(e) => setGateAnswer(e.target.value)}
                    className="w-20 rounded-lg border px-3 py-1 text-center"
                  />
                  <button
                    onClick={() => {
                      if (Number(gateAnswer) === gateNums[0] + gateNums[1]) setGateOpen(true);
                    }}
                    className="rounded-lg bg-slate-700 px-4 py-1 font-semibold text-white"
                  >
                    View
                  </button>
                </div>
              </div>
            ) : (
              <ParentReport
                baseline={baseline}
                levelCounts={report.levelCounts}
                totalLogs={report.totalLogs}
                deviationEvents={report.deviationEvents}
                log={report.log}
                sessionStartT={report.sessionStartT}
                sessionEndT={report.sessionEndT}
                childName={childName}
                childAge={typeof childAge === "number" ? childAge : null}
                parentEmail={parentEmail}
                score={finalScore}
                engineBadge={engineBadge}
              />
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function CameraPreview({ videoRef, roi }: { videoRef: RefObject<HTMLVideoElement | null>; roi: Roi }) {
  // A small visible preview so the child can line their face up, separate from the
  // full-size (hidden) video element the sampler reads from.
  const previewRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const src = videoRef.current?.srcObject;
    if (src && previewRef.current) previewRef.current.srcObject = src;
  }, [videoRef]);
  return (
    <div className="relative h-56 w-56 overflow-hidden rounded-full border-4 border-emerald-400 bg-slate-200">
      <video ref={previewRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" />
      <div
        className="pointer-events-none absolute rounded-full border-2 border-dashed border-white/80"
        style={{
          left: `${roi.xFrac * 100}%`,
          top: `${roi.yFrac * 100}%`,
          width: `${roi.wFrac * 100}%`,
          height: `${roi.hFrac * 100}%`,
        }}
      />
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

function buildRecommendations(opts: {
  dominant: StressLevel;
  elevatedBurstCount: number;
  longestElevatedMs: number;
  hrOutsideAgeRange: boolean;
}): string[] {
  const tips: string[] = [];

  if (opts.dominant === "calm" && opts.elevatedBurstCount === 0) {
    tips.push("Readings stayed calm the whole session — nothing to act on here, just a nice baseline to compare future sessions against.");
  } else if (opts.elevatedBurstCount >= 1) {
    tips.push("A short break, some water, or a few slow breaths together after playing can help if excitement or stress carries over into the next activity.");
    tips.push("One session is just a snapshot — look for a repeating pattern across several play sessions before reading too much into it.");
  }
  if (opts.longestElevatedMs >= 20_000) {
    tips.push("The longest elevated stretch was fairly sustained — worth keeping an eye on whether that happens again with similar games or situations.");
  }
  if (opts.hrOutsideAgeRange) {
    tips.push("Resting heart rate was outside the typical reference range for this age — this is common and often not meaningful on its own, but you could mention it at a routine checkup if you're curious.");
  }
  tips.push("This tool is for play and general awareness, not diagnosis — trust your own judgment about your child over any single reading here.");
  return tips;
}

function buildMailtoHref(opts: {
  childName: string;
  childAge: number | null;
  parentEmail: string;
  score: number;
  dominant: StressLevel;
  levelCounts: Record<StressLevel, number>;
  totalLogs: number;
  elevatedBurstCount: number;
  longestElevatedMs: number;
  longestCalmMs: number;
  deviationCount: number;
  baseline: PersonalBaseline | null;
  ageRangeText: string | null;
  engineBadge: string;
}): string {
  const pct = (lvl: StressLevel) => Math.round((opts.levelCounts[lvl] / opts.totalLogs) * 100);
  const subject = `Mindtrace wellness report — ${opts.childName || "your child"}`;
  const lines = [
    `Mindtrace: Catch the Pets — session report`,
    `Child: ${opts.childName || "(not given)"}${opts.childAge !== null ? `, age ${opts.childAge}` : ""}`,
    `Date: ${new Date().toLocaleString()}`,
    `Engine: ${opts.engineBadge}`,
    ``,
    `Score: ${opts.score} pets caught`,
    `Time calm: ${pct("calm")}%  |  neutral: ${pct("neutral")}%  |  elevated: ${pct("elevated")}%`,
    `Stress bursts (elevated): ${opts.elevatedBurstCount}`,
    `Longest elevated stretch: ${formatDuration(opts.longestElevatedMs)}`,
    `Longest calm stretch: ${formatDuration(opts.longestCalmMs)}`,
    `Sustained changes from personal baseline: ${opts.deviationCount}`,
    opts.baseline ? `Resting HR at calibration: ~${Math.round(opts.baseline.hrMeanBpm)} bpm` : null,
    opts.ageRangeText ? `Typical reference range for this age: ${opts.ageRangeText}` : null,
    ``,
    `Not a medical device — this is a playful, experimental wellness signal from camera-based`,
    `pulse detection (rPPG), using fixed heuristic thresholds. Not a diagnosis.`,
  ].filter((l): l is string => l !== null);

  return `mailto:${encodeURIComponent(opts.parentEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

function ParentReport({
  baseline,
  levelCounts,
  totalLogs,
  deviationEvents,
  log,
  sessionStartT,
  sessionEndT,
  childName,
  childAge,
  parentEmail,
  score,
  engineBadge,
}: {
  baseline: PersonalBaseline | null;
  levelCounts: Record<StressLevel, number>;
  totalLogs: number;
  deviationEvents: DeviationEvent[];
  log: SessionLogEntry[];
  sessionStartT: number;
  sessionEndT: number;
  childName: string;
  childAge: number | null;
  parentEmail: string;
  score: number;
  engineBadge: string;
}) {
  const dominant = (Object.entries(levelCounts) as [StressLevel, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "neutral";
  const copy = STRESS_COPY[dominant];

  const bursts = useMemo(() => computeBursts(log, DEVIATION_CONFIG.windowMs), [log]);
  const elevatedBursts = useMemo(() => bursts.filter((b) => b.level === "elevated"), [bursts]);
  const longestElevated = longestBurstForLevel(bursts, "elevated");
  const longestCalm = longestBurstForLevel(bursts, "calm");

  const ageRange = childAge !== null ? getAgeReferenceRange(childAge) : null;
  const hrOutsideAgeRange =
    !!baseline && !!ageRange && (baseline.hrMeanBpm < ageRange.restingHrLowBpm || baseline.hrMeanBpm > ageRange.restingHrHighBpm);

  const recommendations = buildRecommendations({
    dominant,
    elevatedBurstCount: elevatedBursts.length,
    longestElevatedMs: longestElevated?.durationMs ?? 0,
    hrOutsideAgeRange,
  });

  const mailtoHref = buildMailtoHref({
    childName,
    childAge,
    parentEmail,
    score,
    dominant,
    levelCounts,
    totalLogs,
    elevatedBurstCount: elevatedBursts.length,
    longestElevatedMs: longestElevated?.durationMs ?? 0,
    longestCalmMs: longestCalm?.durationMs ?? 0,
    deviationCount: deviationEvents.length,
    baseline,
    ageRangeText: ageRange ? `${ageRange.restingHrLowBpm}–${ageRange.restingHrHighBpm} bpm (ages ${ageRange.minAge}–${ageRange.maxAge})` : null,
    engineBadge,
  });

  return (
    <div className="mx-auto max-w-lg space-y-5 text-sm text-slate-700">
      <div className="rounded-xl bg-emerald-50 p-4 text-center">
        <div className="text-3xl">{copy.emoji}</div>
        <p className="mt-1 font-semibold">
          {childName ? `${childName} was mostly` : "Mostly"} {copy.label.toLowerCase()} during the session
        </p>
        <p className="text-slate-500">{copy.parentNote}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {(["calm", "neutral", "elevated"] as StressLevel[]).map((lvl) => (
          <div key={lvl} className="rounded-lg bg-slate-50 p-3">
            <div className="text-lg">{STRESS_COPY[lvl].emoji}</div>
            <div className="font-bold">{Math.round((levelCounts[lvl] / totalLogs) * 100)}%</div>
            <div className="text-xs text-slate-500">{STRESS_COPY[lvl].label}</div>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 font-semibold">Stress level over the session</p>
        <StressTimelineChart log={log} sessionStartT={sessionStartT} sessionEndT={sessionEndT} elevatedBursts={elevatedBursts} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-rose-50 p-3">
          <div className="font-bold text-rose-700">{elevatedBursts.length}</div>
          <div className="text-xs text-slate-500">Stress burst{elevatedBursts.length === 1 ? "" : "s"}</div>
        </div>
        <div className="rounded-lg bg-rose-50 p-3">
          <div className="font-bold text-rose-700">{longestElevated ? formatDuration(longestElevated.durationMs) : "—"}</div>
          <div className="text-xs text-slate-500">Longest stretch of stress</div>
        </div>
      </div>

      {baseline && (
        <div className="text-xs text-slate-500">
          <p>
            Personal baseline (from pre-game calibration): resting heart rate ≈ {Math.round(baseline.hrMeanBpm)} bpm, RMSSD ≈{" "}
            {Math.round(baseline.rmssdMeanMs)} ms.
          </p>
          {ageRange && (
            <p className="mt-1">
              General pediatric reference range for ages {ageRange.minAge}–{ageRange.maxAge}: {ageRange.restingHrLowBpm}–
              {ageRange.restingHrHighBpm} bpm resting. (Broad general reference, not derived from this app or this child&apos;s data —
              individual kids vary a lot.)
            </p>
          )}
        </div>
      )}

      <div>
        <p className="font-semibold">Sustained changes from this child&apos;s own baseline</p>
        {deviationEvents.length === 0 ? (
          <p className="text-slate-500">None detected this session — readings stayed close to their personal baseline.</p>
        ) : (
          <ul className="mt-1 list-inside list-disc text-slate-600">
            {deviationEvents.map((e, i) => (
              <li key={i}>
                {new Date(e.t).toLocaleTimeString()} — sustained {e.direction === "elevated" ? "increase" : "decrease"} in
                arousal (RMSSD ≈ {Math.round(e.rmssdMs)} ms)
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="font-semibold">For grown-ups</p>
        <ul className="mt-1 list-inside list-disc space-y-1 text-slate-600">
          {recommendations.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </div>

      {parentEmail && (
        <a
          href={mailtoHref}
          className="block rounded-full bg-slate-700 px-6 py-2 text-center font-semibold text-white hover:bg-slate-800"
        >
          Send Report to {parentEmail}
        </a>
      )}

      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
        This is a playful, experimental wellness signal — not a medical device and not a diagnosis. It&apos;s estimated
        from camera-based pulse detection (rPPG) using fixed heuristic thresholds, and works best in good, steady
        lighting. All processing happens locally in this browser; no video is recorded or uploaded. &quot;Send Report&quot;
        opens your own email app with a summary pre-filled — nothing is sent anywhere automatically.
      </p>
    </div>
  );
}
