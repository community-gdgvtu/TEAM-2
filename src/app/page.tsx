import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <div className="text-6xl">🐾🧺💓</div>
      <h1 className="text-4xl font-extrabold text-emerald-700">Mindtrace: Catch the Pets</h1>
      <p className="max-w-lg text-lg text-slate-600">
        A simple catch game for kids that gently watches your heartbeat with the camera while you
        play — no wires, nothing to wear. Everything runs privately in this browser.
      </p>

      <ul className="grid w-full gap-3 text-left text-sm text-slate-600 sm:grid-cols-2">
        <li className="rounded-xl bg-white p-4 shadow">
          🎮 <b>Catch the Pets</b> — move your basket to catch falling animals. Miss 3 and the round ends.
        </li>
        <li className="rounded-xl bg-white p-4 shadow">
          📷 <b>Camera pulse (rPPG)</b> — estimates heart rate from tiny color changes in your face,
          using the classical POS algorithm.
        </li>
        <li className="rounded-xl bg-white p-4 shadow">
          🧠 <b>Personal baseline</b> — a quick 20-second calibration learns what &quot;normal&quot; looks like for
          this child before playing.
        </li>
        <li className="rounded-xl bg-white p-4 shadow">
          👪 <b>Grown-up report</b> — after playing, a simple report shows if readings stayed near
          baseline or showed a sustained change.
        </li>
      </ul>

      <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href="/play"
          className="rounded-full bg-emerald-500 px-8 py-4 text-lg font-bold text-white shadow-lg hover:bg-emerald-600"
        >
          Start Playing (Classic)
        </Link>
        <Link
          href="/play-ai"
          className="rounded-full bg-indigo-500 px-8 py-4 text-lg font-bold text-white shadow-lg hover:bg-indigo-600"
        >
          Try the AI Model (ONNX)
        </Link>
      </div>
      <p className="max-w-lg text-xs text-slate-500">
        <b>Classic</b> uses fast, lightweight signal processing (POS) and runs smoothly on any device.{" "}
        <b>AI Model</b> runs a PhysNet 3D-CNN, converted from a Hugging Face checkpoint, entirely on-device via
        ONNX Runtime Web — more accurate in principle, but heavier: a new reading roughly every 10s, and it may
        be slow on older hardware.
      </p>

      <p className="mt-2 max-w-md text-xs text-slate-400">
        Not a medical device. Camera video is processed locally and is never recorded or uploaded.
        Stress estimates use simple, fixed heuristic thresholds — see the report screen for details.
      </p>
    </main>
  );
}
