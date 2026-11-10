# Start both ORVIX Backend and Frontend
# This script starts both servers in separate console windows

$ErrorActionPreference = "Stop"

# Get the project root (one level up from scripts/)
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ScriptsDir = Join-Path $ProjectRoot "scripts"

Write-Host "ORVIX Full Stack Startup" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting backend and frontend in separate windows..." -ForegroundColor Green
Write-Host ""

# Start backend in a new PowerShell window
$BackendScript = Join-Path $ScriptsDir "start-backend.ps1"
Start-Process powershell -ArgumentList "-NoExit", "-File", $BackendScript

# Wait a moment for backend to start
Start-Sleep -Seconds 2

# Start frontend in a new PowerShell window
$FrontendScript = Join-Path $ScriptsDir "start-frontend.ps1"
Start-Process powershell -ArgumentList "-NoExit", "-File", $FrontendScript

Write-Host "Both servers starting..." -ForegroundColor Green
Write-Host ""
Write-Host "Backend API:  http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "API Docs:     http://127.0.0.1:8000/docs" -ForegroundColor Cyan
Write-Host "Frontend:     http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C in each window to stop the servers" -ForegroundColor Yellow
