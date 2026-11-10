# Start ORVIX Backend Server
# This script locates the project root from its own location and starts the backend

$ErrorActionPreference = "Stop"

# Get the project root (one level up from scripts/)
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"

Write-Host "ORVIX Backend Startup" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project Root: $ProjectRoot" -ForegroundColor Gray
Write-Host "Backend Dir:  $BackendDir" -ForegroundColor Gray
Write-Host ""

# Check if backend directory exists
if (-not (Test-Path $BackendDir)) {
    Write-Host "ERROR: Backend directory not found at $BackendDir" -ForegroundColor Red
    exit 1
}

# Check if .env exists
$EnvFile = Join-Path $BackendDir ".env"
if (-not (Test-Path $EnvFile)) {
    Write-Host "WARNING: .env file not found at $EnvFile" -ForegroundColor Yellow
    Write-Host "Copy .env.example to .env and fill in your credentials" -ForegroundColor Yellow
    Write-Host ""
}

# Change to backend directory and start the server
Set-Location $BackendDir

Write-Host "Starting uvicorn server..." -ForegroundColor Green
Write-Host "API will be available at: http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "API docs available at:    http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host ""

# Run uvicorn with uv
uv run uvicorn app.main:app --reload --port 8000
