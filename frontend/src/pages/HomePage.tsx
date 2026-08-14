import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div>
      <section className="hero">
        <h1>MINDTRACE</h1>
        <p>
          Turn children's play into a privacy-preserving early wellness signal by understanding
          how their behavior and physiology change over time.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/play" className="btn btn-primary">
            🎮 Start Playing
          </Link>
          <Link to="/dashboard" className="btn btn-secondary">
            📊 Parent Dashboard
          </Link>
        </div>
      </section>

      <div className="pipeline">
        <span className="pipeline-step">🎮 Game</span>
        <span className="pipeline-arrow">→</span>
        <span className="pipeline-step">👁️ Multimodal Sensing</span>
        <span className="pipeline-arrow">→</span>
        <span className="pipeline-step">🧠 Personal Baseline</span>
        <span className="pipeline-arrow">→</span>
        <span className="pipeline-step">🤖 AI Analysis</span>
        <span className="pipeline-arrow">→</span>
        <span className="pipeline-step">📊 Wellness Signal</span>
      </div>

      <div className="card-grid" style={{ marginTop: '2rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '0.75rem' }}>🔍 What We Sense</h3>
          <ul style={{ color: 'var(--text-muted)', paddingLeft: '1.2rem', lineHeight: 2 }}>
            <li>Camera: gaze, blink, head movement, attention</li>
            <li>Webcam rPPG: heart rate + HRV</li>
            <li>Game behavior: reaction time, hesitation, errors</li>
            <li>Longitudinal comparison with personal baseline</li>
          </ul>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: '0.75rem' }}>🔥 PRS — Killer Feature</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
            Instead of asking <em>"Does this child look anxious?"</em>, MINDTRACE asks:{' '}
            <strong style={{ color: 'var(--primary)' }}>
              "Is this child's response today significantly different from their own normal pattern?"
            </strong>
          </p>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: '0.75rem' }}>⚙️ Tech Stack</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
            React · Phaser.js · MediaPipe · FastAPI · Python ML · rPPG (POS method) · SHAP-style
            explanations
          </p>
        </div>
      </div>

      <div className="disclaimer">
        ⚠️ MINDTRACE is a screening / early-warning tool only — NOT a diagnosis. Always consult a
        healthcare professional for clinical concerns.
      </div>
    </div>
  );
}
