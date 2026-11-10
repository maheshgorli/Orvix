@echo off
title Frontend Server

echo =========================
echo Starting Frontend...
echo =========================

cd /d "%~dp0frontend"

npm run dev

pause