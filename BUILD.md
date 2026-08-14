# MINDTRACE — Step-by-Step Build Guide

Build and demo the hackathon project in **5 clear steps**.

---

## Overview

```
Step 1 → Backend (FastAPI + ML)
Step 2 → Frontend (React + Phaser game)
Step 3 → Run both servers
Step 4 → Demo flow (play + dashboard)
Step 5 → Hackathon pitch points
```

---

## Step 1 — Backend Setup

**What it does:** Stores child profiles, game sessions, personal baselines (PRS), and wellness signals.

```powershell
cd backend
py -3.11 -m pip install -r requirements.txt
py -3.11 -m uvicorn app.main:app --reload --port 8000
```

**Verify:** Open http://localhost:8000/docs — you should see the API documentation.

**Quick test:**
```powershell
py -3.11 test_api.py
```

---

## Step 2 — Frontend Setup

**What it does:** Bubble-pop game, webcam sensing (MediaPipe + rPPG), parent dashboard.

```powershell
cd frontend
npm install
npm run dev
```

**Verify:** Open http://localhost:5173 — home page loads.

---

## Step 3 — Run Full Stack

You need **two terminals**:

| Terminal | Command | URL |
|----------|---------|-----|
| 1 — Backend | `cd backend` → `py -3.11 -m uvicorn app.main:app --reload --port 8000` | http://localhost:8000 |
| 2 — Frontend | `cd frontend` → `npm run dev` | http://localhost:5173 |

**Requirements:** Webcam permission (for sensing during play).

---

## Step 4 — Demo Flow (5 minutes)

### 4a. Create child profile
1. Go to **Play** page
2. Enter name + age (3–12)
3. Click **Create Profile**
4. Select the child from dropdown

### 4b. Baseline session (establishes PRS)
1. Set session type → **Baseline**
2. Click **Start Game (60s)**
3. Allow webcam access
4. Pop bubbles for 60 seconds
5. Session saves automatically → personal baseline created

### 4c. Regular play session
1. Set session type → **Regular Play Session**
2. Play again — system compares to *their* baseline, not population norms

### 4d. Parent dashboard
1. Go to **Dashboard**
2. Select child
3. View:
   - Deviation score & risk level
   - PRS baseline metrics
   - Trend chart
   - Explainable AI — why a pattern was flagged

---

## Step 5 — What to Say in the Pitch

| Point | One-liner |
|-------|-----------|
| **Problem** | Kids 3–12 can't self-report anxiety; professional help is expensive |
| **Solution** | Passive wellness screening through a fun game |
| **Innovation (PRS)** | Compares child to *their own* baseline, not "do they look anxious?" |
| **Tech** | Webcam rPPG (HR/HRV) + MediaPipe gaze + game behavior → ML fusion |
| **Research** | Based on Hendryani et al. IEEE Access 2024 — webcam stress detection |
| **Disclaimer** | Screening tool only — NOT a diagnosis |

---

## Architecture (for judges)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Phaser.js  │────▶│  MediaPipe +     │────▶│  FastAPI    │
│  Bubble Game│     │  rPPG (browser)  │     │  Backend    │
└─────────────┘     └──────────────────┘     └──────┬──────┘
                                                     │
                    ┌──────────────────┐             │
                    │ Personal Baseline│◀────────────┘
                    │ (PRS)            │
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ Deviation + SHAP │
                    │ Parent Dashboard │
                    └──────────────────┘
```

---

## Project Structure

```
TEAM-2/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI entry
│   │   ├── models.py         # DB models
│   │   ├── routers/          # API routes
│   │   └── services/
│   │       ├── rppg.py       # Webcam HR/HRV pipeline
│   │       ├── baseline.py   # PRS personal baseline
│   │       └── explainer.py  # Parent-friendly explanations
│   ├── requirements.txt
│   └── test_api.py           # Smoke test
├── frontend/
│   ├── src/
│   │   ├── game/BubbleGame.ts      # Phaser game
│   │   ├── sensing/SensingEngine.ts # MediaPipe + rPPG
│   │   └── pages/                  # Home, Play, Dashboard
│   └── package.json
├── BUILD.md                  # This file
└── README.md
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Python 3.14` numpy fails | Use **Python 3.11**: `py -3.11 -m pip install -r requirements.txt` |
| Camera not working | Use Chrome/Edge, allow webcam, HTTPS not required on localhost |
| Backend connection failed | Ensure backend runs on port 8000 before starting frontend |
| No wellness signal | Complete at least 1 baseline session first |
| MediaPipe slow first load | Models download from CDN on first play — wait ~5s |

---

## Optional: PostgreSQL

Default uses SQLite (zero config). For PostgreSQL:

```powershell
docker compose up -d
# Set env: DATABASE_URL=postgresql://mindtrace:mindtrace@localhost:5432/mindtrace
```

---

## Hackathon Tips

1. **Demo with 2 sessions** — baseline + one "different" play session to show deviation
2. **Show dashboard explanation** — judges love explainable AI
3. **Emphasize PRS** — your killer differentiator vs generic emotion detection
4. **Lead with disclaimer** — screening only, builds trust

Good luck! 🧠🎮
