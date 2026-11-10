@echo off
title Backend Server

echo =========================
echo Starting Backend...
echo =========================

cd /d "%~dp0backend"

uv run uvicorn app.main:app --reload --port 8000

pause