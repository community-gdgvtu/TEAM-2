# MINDTRACE — TEAM-2 (GDG VTU Hackathon)

AI-powered child wellness screening for **SDG 3 — Good Health & Well-Being**.

This repo contains **two implementations** of the MINDTRACE concept:

| Project | Location | Stack | Description |
|---------|----------|-------|-------------|
| **Catch the Pets** (on-device prototype) | Root `/` | Next.js 16, ONNX, TypeScript rPPG | Browser-only stress sensing during a catch game |
| **MINDTRACE Full Stack** (hackathon demo) | `/frontend` + `/backend` | React, Phaser, MediaPipe, FastAPI | Game + webcam sensing + PRS baseline + parent dashboard |

⚠️ **Screening / early-warning tools only — NOT medical diagnosis.**

---

## MINDTRACE Full Stack (recommended for demo)

> **Step-by-step guide:** [BUILD.md](BUILD.md)

### Quick Start

**Terminal 1 — Backend**
```powershell
cd backend
py -3.11 -m pip install -r requirements.txt
py -3.11 -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend**
```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

Or use `start-backend.bat` and `start-frontend.bat`.

### Features
- Bubble-pop game (Phaser.js)
- MediaPipe gaze + webcam rPPG (HR/HRV)
- **PRS** — Personalized Response Signature (compare to child's own baseline)
- Parent dashboard with explainable wellness signals

### Architecture
```
Game → Camera + Behavior → Feature Fusion → Personal Baseline (PRS)
     → ML Deviation Detection → Explainable Signal → Parent Dashboard
```

---

## Catch the Pets (Next.js prototype)

On-device-only prototype — no video uploaded.

```bash
npm install
npm run dev
```

Open http://localhost:3000 — try **Classic** (`/play`) or **AI Model** (`/play-ai`).

---

## Research

rPPG pipeline inspired by Hendryani et al., *Enhancement of Stress Classification Using Web Camera-Based Imaging Photoplethysmography With a Frame Alignment Method*, IEEE Access 2024.

## License

See [LICENSE](LICENSE). For educational / hackathon demonstration purposes.
