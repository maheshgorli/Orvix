# Start ORVIX Frontend Development Server
# This script locates the project root from its own location and starts the frontend

$ErrorActionPreference = "Stop"

# Get the project root (one level up from scripts/)
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $ProjectRoot "frontend"

Write-Host "ORVIX Frontend Startup" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project Root:  $ProjectRoot" -ForegroundColor Gray
Write-Host "Frontend Dir:  $FrontendDir" -ForegroundColor Gray
Write-Host ""

# Check if frontend directory exists
if (-not (Test-Path $FrontendDir)) {
    Write-Host "ERROR: Frontend directory not found at $FrontendDir" -ForegroundColor Red
    exit 1
}

# Check if node_modules exists
$NodeModules = Join-Path $FrontendDir "node_modules"
if (-not (Test-Path $NodeModules)) {
    Write-Host "WARNING: node_modules not found. Running npm install..." -ForegroundColor Yellow
    Set-Location $FrontendDir
    npm install
    Write-Host ""
}

# Change to frontend directory and start the dev server
Set-Location $FrontendDir

Write-Host "Starting Vite development server..." -ForegroundColor Green
Write-Host "Frontend will be available at: http://localhost:5173" -ForegroundColor Green
Write-Host ""

# Run the dev server
npm run dev
