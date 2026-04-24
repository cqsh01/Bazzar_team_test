@echo off
setlocal enabledelayedexpansion

set PORT_API=8000
set PORT_VITE=5173

echo === Bazaar Simulator — Local Startup ===
echo.

REM --- Python check ---
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Python is not installed or not on PATH.
    echo Install Python 3.9+ and try again.
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo [OK] Python found: %PY_VER%

REM --- Node check ---
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not on PATH.
    echo Install Node 18+ and try again.
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo [OK] Node found: %NODE_VER%

REM --- npm check ---
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: npm is not installed.
    exit /b 1
)

REM --- Install Python deps ---
echo.
echo Installing Python server dependencies...
python -m pip install -e ".[server]" --quiet 2>nul
if %ERRORLEVEL% neq 0 (
    python -m pip install -e ".[server]"
)

REM --- Install web deps ---
if not exist "web\node_modules" (
    echo Installing web dependencies...
    pushd web
    call npm install
    popd
)

REM --- Start API bridge ---
echo.
echo Starting API bridge on port %PORT_API%...
start "BazaarAPI" /min python -m minimal_sim_core.server --port %PORT_API%

REM --- Health check ---
echo Waiting for API bridge...
set RETRIES=0
:healthloop
if %RETRIES% geq 20 (
    echo ERROR: API bridge failed to start on port %PORT_API%.
    echo Check that Python and FastAPI are installed correctly.
    exit /b 1
)
timeout /t 1 /nobreak >nul
curl -sf "http://localhost:%PORT_API%/api/schema" >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [OK] API bridge is healthy.
    goto :healthdone
)
set /a RETRIES+=1
goto :healthloop
:healthdone

REM --- Start Vite ---
echo.
echo Starting Vite dev server...
pushd web
start "BazaarVite" cmd /c "npm run dev"
popd

timeout /t 3 /nobreak >nul

REM --- Open browser ---
set URL=http://localhost:%PORT_VITE%
echo.
echo === Ready! Opening %URL% ===
start "" "%URL%"

echo.
echo Press Ctrl+C to stop the servers.
echo Close this window to terminate all processes.
pause >nul
