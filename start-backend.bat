@echo off
echo Starting MINDTRACE Backend...
cd /d "%~dp0backend"
py -3.11 -m uvicorn app.main:app --reload --port 8000
