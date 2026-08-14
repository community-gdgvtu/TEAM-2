"""Quick API smoke test for MINDTRACE backend."""

import json
import urllib.error
import urllib.request

BASE = "http://localhost:8000"


def req(method: str, path: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body else None
    request = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"} if body else {},
        method=method,
    )
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read().decode())


def main() -> None:
    print("1. Health check...")
    print(req("GET", "/health"))

    print("\n2. Create child...")
    child = req("POST", "/api/children", {"name": "Demo Kid", "age": 7})
    print(child)
    child_id = child["id"]

    print("\n3. Submit baseline session...")
    session = req(
        "POST",
        "/api/sessions",
        {
            "child_id": child_id,
            "session_type": "baseline",
            "duration_sec": 60,
            "features": {
                "physio": {"mean_hr": 85, "hrv_sdnn": 45, "hrv_lf": 0.3, "hrv_hf": 0.5, "signal_quality": 0.8},
                "gaze": {"blink_rate": 12, "gaze_stability": 0.85, "head_movement": 0.02, "attention_score": 0.9},
                "game": {
                    "avg_reaction_time_ms": 450,
                    "reaction_time_std": 80,
                    "error_rate": 0.1,
                    "retry_rate": 0,
                    "hesitation_count": 1,
                    "total_events": 20,
                    "score": 800,
                },
            },
            "game_events": {"score": 800},
        },
    )
    print(f"Session #{session['id']} created")

    print("\n4. Submit play session (elevated signals)...")
    session2 = req(
        "POST",
        "/api/sessions",
        {
            "child_id": child_id,
            "session_type": "play",
            "duration_sec": 60,
            "features": {
                "physio": {"mean_hr": 110, "hrv_sdnn": 25, "hrv_lf": 0.8, "hrv_hf": 0.2, "signal_quality": 0.75},
                "gaze": {"blink_rate": 22, "gaze_stability": 0.55, "head_movement": 0.08, "attention_score": 0.6},
                "game": {
                    "avg_reaction_time_ms": 750,
                    "reaction_time_std": 200,
                    "error_rate": 0.35,
                    "retry_rate": 0.2,
                    "hesitation_count": 5,
                    "total_events": 18,
                    "score": 400,
                },
            },
            "game_events": {"score": 400},
        },
    )
    ws = session2.get("wellness_signal")
    if ws:
        print(f"Risk: {ws['risk_level']} | Score: {ws['deviation_score']}")
        print(f"Explanation: {ws['explanation'][:120]}...")

    print("\n5. Dashboard...")
    dashboard = req("GET", f"/api/children/{child_id}/dashboard")
    print(f"Baseline ready: {dashboard['baseline_ready']}")
    print(f"Total sessions: {dashboard['total_sessions']}")
    print("\nAll tests passed!")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.URLError as exc:
        print(f"Backend not running. Start it first:\n  cd backend && py -3.11 -m uvicorn app.main:app --reload --port 8000\n\nError: {exc}")
