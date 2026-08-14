# Mindtrace: Catch the Pets

A prototype for GDG VTU's SDG hackathon (SDG 3 — Good Health & Well-Being) that reads a child's physiological stress response — entirely on-device, in the browser — starting with a simple catch-the-pet game.

No video is ever recorded or uploaded. All camera processing happens locally.

## What it does

1. A quick pre-game form (name, age, parent email) and consent step.
2. A 20-second calibration builds a personal resting-HR / HRV baseline for that specific child.
3. While the child plays, the camera estimates heart rate and heart-rate variability (HRV) from subtle color changes in their skin (remote photoplethysmography, rPPG) and classifies stress against their own baseline — not a generic cutoff.
4. After the round, a parent-gated report shows a stress timeline chart, stress bursts, the longest sustained stress stretch, a general pediatric HR reference comparison, and a few plain-language recommendations — with an optional `mailto:` summary.

Two interchangeable pulse-extraction engines:

- **Classic** — the classical POS signal-processing algorithm (Wang et al., 2017), hand-ported to TypeScript. Fast, runs on any device.
- **AI Model (ONNX)** — a PhysNet 3D-CNN converted from a Hugging Face checkpoint ([`hyunseop/vision-cardio-rppg`](https://huggingface.co/hyunseop/vision-cardio-rppg)) to ONNX and run client-side via ONNX Runtime Web (Worker-proxied so it never blocks the game). More accurate, heavier.

This website/game is a research prototype proving the sensing pipeline works end-to-end — not the intended final product. The longer-term vision: a background layer that watches for harmful stress and dopamine bursts across any screen a child uses, parent-controlled, fully on-device.

## Tech stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS 4 · ONNX Runtime Web · a custom HRV/stress/baseline pipeline · Playwright for end-to-end verification.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Try **Classic** (`/play`) or **AI Model** (`/play-ai`).

## Disclaimer

Not a medical device. Stress classification uses fixed heuristic thresholds, not clinically validated cutoffs. Built for prototyping and research purposes.
