import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { createBubbleGame, type GameStats } from '../game/BubbleGame';
import { initCamera, SensingEngine, stopCamera } from '../sensing/SensingEngine';
import type { Child, SessionResult } from '../types';

type Phase = 'setup' | 'calibrating' | 'playing' | 'submitting' | 'done';

export default function PlayPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<HTMLDivElement>(null);
  const sensingRef = useRef<SensingEngine | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const phaserRef = useRef<ReturnType<typeof createBubbleGame> | null>(null);
  const startingRef = useRef(false);

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState(7);
  const [sessionType, setSessionType] = useState<'baseline' | 'play'>('baseline');
  const [phase, setPhase] = useState<Phase>('setup');
  const [signalQuality, setSignalQuality] = useState(0);
  const [error, setError] = useState('');
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [result, setResult] = useState<SessionResult | null>(null);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);

  const cleanup = useCallback(() => {
    sensingRef.current?.stop();
    sensingRef.current = null;
    stopCamera(streamRef.current);
    streamRef.current = null;
    phaserRef.current?.destroy(true);
    phaserRef.current = null;
    startingRef.current = false;
  }, []);

  useEffect(() => {
    api
      .listChildren()
      .then((list) => {
        setChildren(list);
        setBackendOk(true);
      })
      .catch(() => {
        setBackendOk(false);
        setError('Backend not running. Start it with: cd backend && py -3.11 -m uvicorn app.main:app --reload --port 8000');
      });
    return () => cleanup();
  }, [cleanup]);

  const handleGameComplete = useCallback(
    async (stats: GameStats) => {
      if (!selectedChildId || !sensingRef.current) return;
      setPhase('submitting');
      setStatusMsg('Analyzing session...');

      sensingRef.current.stop();
      const gaze = sensingRef.current.getGazeFeatures();
      const rgb = sensingRef.current.getRgbSignal();
      const duration = sensingRef.current.getDurationSec();

      try {
        const session = await api.submitSession({
          child_id: selectedChildId,
          session_type: sessionType,
          duration_sec: duration,
          features: {
            physio: { signal_quality: signalQuality },
            gaze,
            game: stats.features,
          },
          game_events: { events: stats.events, score: stats.score },
          rgb_signal: rgb,
        });
        setResult(session);
        setGameStats(stats);
        setPhase('done');
        setStatusMsg('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to submit session');
        setPhase('setup');
        cleanup();
      }
    },
    [selectedChildId, sessionType, signalQuality, cleanup]
  );

  // Start camera + game AFTER play UI mounts (refs exist)
  useEffect(() => {
    if (phase !== 'calibrating' || !startingRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const gameEl = gameRef.current;
    if (!video || !canvas || !gameEl) return;

    let cancelled = false;

    (async () => {
      try {
        setStatusMsg('Requesting camera...');
        streamRef.current = await initCamera(video);

        if (cancelled) return;

        setStatusMsg('Loading face detection models...');
        const engine = new SensingEngine(video, canvas);
        engine.onFrame = (q) => setSignalQuality(q);
        await engine.init();
        sensingRef.current = engine;

        if (cancelled) return;

        engine.start();
        setStatusMsg('Calibrating sensors...');
        await new Promise((r) => setTimeout(r, 2000));

        if (cancelled) return;

        setPhase('playing');
        setStatusMsg('Pop the bubbles!');

        phaserRef.current = createBubbleGame(gameEl, 30, (stats) => {
          handleGameComplete(stats);
        });
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : 'Camera or sensing failed. Allow webcam access and try again.'
          );
          setPhase('setup');
          cleanup();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, handleGameComplete, cleanup]);

  const handleCreateChild = async () => {
    if (!newName.trim()) return;
    setError('');
    try {
      const child = await api.createChild(newName.trim(), newAge);
      setChildren((prev) => [child, ...prev]);
      setSelectedChildId(child.id);
      setNewName('');
      setBackendOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create profile — is backend running?');
    }
  };

  const startSession = () => {
    if (!selectedChildId) return;
    if (backendOk === false) {
      setError('Backend is not running. Start the API server first.');
      return;
    }
    setError('');
    setResult(null);
    startingRef.current = true;
    setPhase('calibrating');
    setStatusMsg('Starting session...');
  };

  if (phase === 'done' && result) {
    const ws = result.wellness_signal;
    return (
      <div className="session-result">
        <h2>Session Complete!</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Score: {gameStats?.score ?? 0} · Duration: {Math.round(result.duration_sec)}s
        </p>
        {ws && (
          <>
            <span className={`badge badge-${ws.risk_level}`}>{ws.risk_level}</span>
            <p style={{ margin: '1rem 0', fontSize: '1.2rem' }}>
              Deviation Score: <strong>{ws.deviation_score}</strong>
            </p>
            <div className="explanation-box">{ws.explanation}</div>
          </>
        )}
        {!ws && (
          <div className="explanation-box">
            Baseline session recorded! Play again to enable PRS comparison.
          </div>
        )}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              cleanup();
              setPhase('setup');
              setResult(null);
            }}
          >
            Play Again
          </button>
          <Link to={`/dashboard/${selectedChildId}`} className="btn btn-accent">
            View Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (phase === 'calibrating' || phase === 'playing' || phase === 'submitting') {
    return (
      <div>
        <h2 style={{ marginBottom: '0.5rem' }}>
          {phase === 'submitting' ? 'Analyzing...' : phase === 'calibrating' ? 'Setting up...' : 'Bubble Pop!'}
        </h2>
        {statusMsg && (
          <p style={{ color: 'var(--accent)', marginBottom: '1rem', fontWeight: 600 }}>{statusMsg}</p>
        )}
        <div className="play-layout">
          <div className="game-panel">
            <div className="game-container" ref={gameRef} />
          </div>
          <div className="sensing-stats">
            <div className="camera-panel">
              <video ref={videoRef} playsInline muted autoPlay />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div className="camera-overlay">
                rPPG · MediaPipe · {Math.round(signalQuality * 100)}% signal
              </div>
            </div>
            <div className="stat-item">
              <span className="stat-label">Signal Quality</span>
              <span className="stat-value">{Math.round(signalQuality * 100)}%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Session Type</span>
              <span className="stat-value">{sessionType}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>Start a Play Session</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Create a profile, then play the bubble game while MINDTRACE senses behavior + physiology.
      </p>

      {backendOk === false && (
        <div className="error-msg">
          Backend offline. Run in a terminal:{' '}
          <code>cd backend && py -3.11 -m uvicorn app.main:app --reload --port 8000</code>
        </div>
      )}
      {backendOk === true && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(107,203,119,0.15)', borderRadius: 12, marginBottom: '1rem', color: 'var(--primary)', fontWeight: 600 }}>
          Backend connected
        </div>
      )}
      {error && <div className="error-msg">{error}</div>}

      <div className="card-grid">
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Child Profile</h3>
          {children.length > 0 && (
            <div className="form-group">
              <label>Select Child</label>
              <select
                value={selectedChildId ?? ''}
                onChange={(e) => setSelectedChildId(Number(e.target.value))}
              >
                <option value="">Choose...</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (age {c.age}) {c.has_baseline ? '✓ baseline' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Or Create New</label>
            <input placeholder="Child's name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Age (3–12)</label>
            <input type="number" min={3} max={12} value={newAge} onChange={(e) => setNewAge(Number(e.target.value))} />
          </div>
          <button className="btn btn-secondary" onClick={handleCreateChild} style={{ width: '100%' }}>
            Create Profile
          </button>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Session Settings</h3>
          <div className="form-group">
            <label>Session Type</label>
            <select value={sessionType} onChange={(e) => setSessionType(e.target.value as 'baseline' | 'play')}>
              <option value="baseline">Baseline (establish PRS)</option>
              <option value="play">Regular Play Session</option>
            </select>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={!selectedChildId || backendOk === false}
            onClick={startSession}
          >
            Start Game (30s)
          </button>
        </div>
      </div>
    </div>
  );
}
