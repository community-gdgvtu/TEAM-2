import Link from "next/link";
import SkyBackground from "@/components/SkyBackground";

const FEATURES = [
  {
    emoji: "🎮",
    title: "Catch the Pets",
    text: "Move your basket to catch falling animals. Miss 3 and the round ends.",
    bg: "bg-pink-100",
    border: "border-pink-300",
  },
  {
    emoji: "📷",
    title: "Camera pulse",
    text: "Gently reads your heart rate from tiny color changes in your face — nothing to wear!",
    bg: "bg-sky-100",
    border: "border-sky-300",
  },
  {
    emoji: "🧠",
    title: "Personal baseline",
    text: "A quick 20-second warm-up learns what feels “normal” for you before playing.",
    bg: "bg-violet-100",
    border: "border-violet-300",
  },
  {
    emoji: "👪",
    title: "Grown-up report",
    text: "After playing, a friendly report for parents shows how the session went.",
    bg: "bg-lime-100",
    border: "border-lime-300",
  },
];

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-7 px-4 py-14 text-center">
      <SkyBackground />

      <div className="animate-pop-in text-7xl drop-shadow-sm">🐾🧺💓</div>

      <h1 className="animate-pop-in text-5xl font-bold text-orange-500 drop-shadow-[0_3px_0_rgba(0,0,0,0.08)] [animation-delay:80ms]">
        Mindtrace
      </h1>
      <p className="-mt-4 text-2xl font-semibold text-sky-600">Catch the Pets!</p>

      <p className="max-w-lg text-lg font-medium text-slate-600">
        A silly, wiggly catch game that gently watches your heartbeat with the camera while you
        play — no wires, nothing to wear. Everything stays private, right here in your browser.
      </p>

      <ul className="grid w-full gap-4 text-left sm:grid-cols-2">
        {FEATURES.map((f) => (
          <li
            key={f.title}
            className={`rounded-3xl border-4 ${f.border} ${f.bg} p-5 shadow-md transition-transform hover:-translate-y-1`}
          >
            <div className="text-3xl">{f.emoji}</div>
            <p className="mt-1 font-display text-lg font-semibold text-slate-800">{f.title}</p>
            <p className="mt-1 text-sm text-slate-600">{f.text}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
        <Link
          href="/play"
          className="animate-wiggle rounded-full bg-emerald-500 px-9 py-4 text-xl font-bold text-white shadow-[0_6px_0_rgb(4,120,87)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          🚀 Start Playing
        </Link>
        <Link
          href="/play-ai"
          className="animate-wiggle rounded-full bg-fuchsia-500 px-9 py-4 text-xl font-bold text-white shadow-[0_6px_0_rgb(162,28,175)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          🤖 Try the AI Model
        </Link>
      </div>
      <p className="max-w-lg text-xs text-slate-500">
        <b>Start Playing</b> uses fast, lightweight signal processing and runs smoothly on any device.{" "}
        <b>AI Model</b> runs a PhysNet 3D-CNN, converted from a Hugging Face checkpoint, entirely on-device —
        more accurate in principle, but heavier: a new reading roughly every 10s, and it may be slow on
        older hardware.
      </p>

      <p className="mt-2 max-w-md rounded-full bg-white/70 px-4 py-2 text-xs text-slate-500 shadow-sm">
        Not a medical device. Camera video is processed locally and is never recorded or uploaded.
        Stress estimates use simple, fixed heuristic thresholds — see the report screen for details.
      </p>
    </main>
  );
}
