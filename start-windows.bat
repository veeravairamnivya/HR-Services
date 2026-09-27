@echo off
REM One-click start for Windows: installs dependencies, starts the API and web app, opens the browser.
cd /d "%~dp0"

where python >nul 2>nul || (echo Python 3.11+ is required: https://www.python.org/downloads/ & pause & exit /b 1)
where npm >nul 2>nul || (echo Node.js 20+ is required: https://nodejs.org/ & pause & exit /b 1)

echo [1/3] Preparing backend...
if not exist backend\.venv python -m venv backend\.venv
backend\.venv\Scripts\python -m pip install -q -r backend\requirements.txt || (pause & exit /b 1)

echo [2/3] Preparing frontend (first run takes a few minutes)...
if not exist frontend\node_modules (
  pushd frontend
  call npm install || (popd & pause & exit /b 1)
  popd
)

echo [3/3] Starting TalentBridge HR...
start "TalentBridge API (close to stop)" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\python -m uvicorn app.main:app --port 8000"
start "TalentBridge Web (close to stop)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Waiting for the app to start...
set /a tries=0
:wait
curl -s -o nul http://localhost:3000/login && goto open
set /a tries+=1
if %tries% geq 90 goto open
timeout /t 2 /nobreak >nul
goto wait
:open
start "" http://localhost:3000
echo.
echo TalentBridge HR is running at http://localhost:3000
echo Close the two server windows to stop it.
pause
