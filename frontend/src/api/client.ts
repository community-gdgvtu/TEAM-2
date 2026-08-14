import type {
  Child,
  DashboardSummary,
  RGBSignal,
  SessionFeatures,
  SessionResult,
} from '../types';

const API = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed: ${res.status}`);
    }
    return res.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error('Cannot reach backend. Start API on http://localhost:8000');
    }
    throw err;
  }
}

export const api = {
  createChild: (name: string, age: number) =>
    request<Child>('/children', {
      method: 'POST',
      body: JSON.stringify({ name, age }),
    }),

  listChildren: () => request<Child[]>('/children'),

  getChild: (id: number) => request<Child>(`/children/${id}`),

  getDashboard: (childId: number) =>
    request<DashboardSummary>(`/children/${childId}/dashboard`),

  submitSession: (payload: {
    child_id: number;
    session_type: string;
    duration_sec: number;
    features: SessionFeatures;
    game_events: Record<string, unknown>;
    rgb_signal?: RGBSignal;
  }) =>
    request<SessionResult>('/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSessions: (childId: number) =>
    request<SessionResult[]>(`/sessions/child/${childId}`),
};
