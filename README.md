# MINDTRACE — AI-Powered Child Wellness Screening

> **Turn children's play into a privacy-preserving early wellness signal by understanding how their behavior and physiology change over time.**

MINDTRACE is a hackathon demo of a privacy-first AI game for children (3–12) that passively analyzes behavioral and physiological responses during gameplay to identify persistent deviations from each child's **Personal Response Signature (PRS)**.

⚠️ **Screening / early-warning tool only — NOT a diagnosis.**

## Architecture

```
Child plays game (Phaser.js)
       ↓
Camera + Game Events (MediaPipe + rPPG)
       ↓
Gaze + HR/HRV + Behavior features
       ↓
Multimodal Feature Fusion → FastAPI Backend
       ↓
Personal Baseline (PRS) comparison
       ↓
ML Deviation Detection + SHAP explanations
       ↓
Parent Dashboard
```

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Game | React, TypeScript, Phaser 3 |
| Sensing | MediaPipe Face Landmarker, Webcam rPPG (POS method) |
| Backend | FastAPI, SQLAlchemy, SQLite/PostgreSQL |
| ML | NumPy, SciPy, Scikit-learn, SHAP |
| Explanations | Rule-based + feature attribution (LLM-ready RAG stub) |

## Quick Start

> **Full step-by-step guide:** see [BUILD.md](BUILD.md)

### Prerequisites
- **Python 3.11** (recommended — 3.14 may fail on numpy)
- Node.js 18+
- Webcam

### Terminal 1 — Backend
```powershell
cd backend
py -3.11 -m pip install -r requirements.txt
py -3.11 -m uvicorn app.main:app --reload --port 8000
```
Or double-click `start-backend.bat`

### Terminal 2 — Frontend
```powershell
cd frontend
npm install
npm run dev
```
Or double-click `start-frontend.bat`

Open **http://localhost:5173**

## Demo Flow

1. **Register child** — name, age (creates PRS profile)
2. **Baseline session** — 60s calm bubble-pop game (establishes personal baseline)
3. **Play sessions** — ongoing gameplay with passive sensing
4. **Parent dashboard** — wellness signals, deviation scores, plain-language explanations

## Research Foundation

rPPG pipeline inspired by:
> Hendryani et al., *Enhancement of Stress Classification Using Web Camera-Based Imaging Photoplethysmography With a Frame Alignment Method*, IEEE Access 2024.

Key techniques: frame alignment, POS chrominance rPPG, HR/HRV extraction, personal baseline deviation (PRS innovation).

## Project Structure

```
├── backend/          # FastAPI + ML pipeline
├── frontend/         # React + Phaser game + dashboard
├── docker-compose.yml
└── README.md
```

## Hackathon Notes

- Camera processing runs **in-browser**; only derived features are sent to the backend
- Baseline requires ≥1 session before deviation detection activates
- Demo mode includes simulated sessions for dashboard testing

## License

MIT — For educational / hackathon demonstration purposes only.
