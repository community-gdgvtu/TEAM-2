import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { api } from '../api/client';
import type { Child, DashboardSummary } from '../types';

export default function DashboardPage() {
  const { childId } = useParams();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(childId ? Number(childId) : null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listChildren().then((list) => {
      setChildren(list);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError('');
    api
      .getDashboard(selectedId)
      .then(setDashboard)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const latestSignal = dashboard?.recent_signals[0];

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>📊 Parent Dashboard</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Personalized Response Signature (PRS) — wellness signals compared to your child's own
        baseline, not population norms.
      </p>

      {children.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">👤</div>
          <p>No child profiles yet.</p>
          <Link to="/play" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Create Profile & Play
          </Link>
        </div>
      ) : (
        <>
          <div className="form-group" style={{ maxWidth: 320, marginBottom: '2rem' }}>
            <label>Select Child</label>
            <select value={selectedId ?? ''} onChange={(e) => setSelectedId(Number(e.target.value))}>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (age {c.age})
                </option>
              ))}
            </select>
          </div>

          {error && <div className="error-msg">{error}</div>}
          {loading && <div className="loading">Loading dashboard...</div>}

          {dashboard && !loading && (
            <>
              <div className="card-grid">
                <div className="card">
                  <h3 style={{ marginBottom: '0.5rem' }}>{dashboard.child.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Age {dashboard.child.age} · {dashboard.total_sessions} sessions
                  </p>
                  <div style={{ marginTop: '1rem' }}>
                    {dashboard.baseline_ready ? (
                      <span className="badge badge-normal">PRS Active</span>
                    ) : (
                      <span className="badge badge-watch">Baseline Needed</span>
                    )}
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ marginBottom: '0.5rem' }}>Latest Signal</h3>
                  {latestSignal ? (
                    <>
                      <span className={`badge badge-${latestSignal.risk_level}`}>
                        {latestSignal.risk_level}
                      </span>
                      <p style={{ fontSize: '2rem', fontWeight: 800, margin: '0.5rem 0' }}>
                        {latestSignal.deviation_score}
                      </p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        deviation score
                      </p>
                    </>
                  ) : (
                    <p style={{ color: 'var(--text-muted)' }}>No signals yet</p>
                  )}
                </div>

                <div className="card">
                  <h3 style={{ marginBottom: '0.5rem' }}>Personal Baseline</h3>
                  {dashboard.prs_summary.key_metrics ? (
                    <div style={{ fontSize: '0.85rem', lineHeight: 2 }}>
                      {Object.entries(
                        dashboard.prs_summary.key_metrics as Record<string, number>
                      ).map(([k, v]) => (
                        <div key={k} className="stat-item">
                          <span className="stat-label">{k.replace(/_/g, ' ')}</span>
                          <span className="stat-value">{v}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)' }}>Complete a baseline session first</p>
                  )}
                </div>
              </div>

              {dashboard.trend.length > 0 && (
                <div className="card" style={{ marginTop: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>Deviation Trend</h3>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dashboard.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => new Date(d).toLocaleDateString()}
                          stroke="#888"
                          fontSize={12}
                        />
                        <YAxis stroke="#888" fontSize={12} />
                        <Tooltip
                          contentStyle={{ background: '#1a1a2e', border: '1px solid #333' }}
                          labelFormatter={(d) => new Date(d).toLocaleString()}
                        />
                        <Line
                          type="monotone"
                          dataKey="deviation_score"
                          stroke="#4d96ff"
                          strokeWidth={2}
                          dot={{ fill: '#6bcb77' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {latestSignal && (
                <div className="card" style={{ marginTop: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>🔎 Explainable AI — Why Flagged?</h3>
                  <div className="explanation-box">{latestSignal.explanation}</div>
                  {Object.keys(latestSignal.shap_values).length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        Feature Contributions
                      </h4>
                      {Object.entries(latestSignal.shap_values)
                        .sort(([, a], [, b]) => b - a)
                        .map(([label, value]) => (
                          <div key={label} className="feature-bar">
                            <span className="feature-bar-label">{label}</span>
                            <div className="feature-bar-track">
                              <div
                                className="feature-bar-fill"
                                style={{ width: `${Math.min(value * 100, 100)}%` }}
                              />
                            </div>
                            <span style={{ fontSize: '0.8rem', width: 40 }}>{(value * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              <div className="disclaimer">
                ⚠️ Screening tool only — not a diagnosis. Persistent elevated signals warrant
                professional consultation.
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <Link to="/play" className="btn btn-primary">
                  🎮 New Play Session
                </Link>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
