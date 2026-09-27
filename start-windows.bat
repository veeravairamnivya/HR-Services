@echo off
setlocal
REM One-click start for Windows: installs dependencies, picks free ports, starts the API and web app,
REM and opens the browser on the exact address TalentBridge is running at.
cd /d "%~dp0"

where python >nul 2>nul || (echo Python 3.11+ is required: https://www.python.org/downloads/ & pause & exit /b 1)
where npm >nul 2>nul || (echo Node.js 20+ is required: https://nodejs.org/ & pause & exit /b 1)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)" || (echo Node.js 20 or newer is required. Install the LTS version from https://nodejs.org/ & pause & exit /b 1)

REM Use 3847 (web) and 8847 (API) unless another program already listens there; then try the next port.
set WEB_PORT=3847
:find_web
netstat -an | findstr /C:":%WEB_PORT% " >nul && (set /a WEB_PORT+=1 & goto find_web)
set API_PORT=8847
:find_api
netstat -an | findstr /C:":%API_PORT% " >nul && (set /a API_PORT+=1 & goto find_api)

echo [1/3] Preparing backend...
if not exist backend\.venv python -m venv backend\.venv
backend\.venv\Scripts\python -m pip install -q -r backend\requirements.txt || (pause & exit /b 1)

echo [2/3] Preparing frontend (first run takes a few minutes)...
pushd frontend
call npm install --no-audit --no-fund || (popd & pause & exit /b 1)
popd

echo [3/3] Starting TalentBridge HR on port %WEB_PORT% ...
set "BACKEND_URL=http://localhost:%API_PORT%"
start "TalentBridge API :%API_PORT% (close to stop)" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\python -m uvicorn app.main:app --port %API_PORT%"
start "TalentBridge Web :%WEB_PORT% (close to stop)" cmd /k "cd /d "%~dp0frontend" && npx next dev -p %WEB_PORT%"

echo Waiting for the app to start...
set /a tries=0
:wait
curl -s http://localhost:%WEB_PORT%/api/health 2>nul | findstr /C:"TalentBridge" >nul && goto open
set /a tries+=1
if %tries% geq 90 (
  echo The app did not start. Check the two server windows for errors.
  pause & exit /b 1
)
timeout /t 2 /nobreak >nul
goto wait
:open
start "" http://localhost:%WEB_PORT%
echo.
echo ============================================================
echo   TalentBridge HR is running at:  http://localhost:%WEB_PORT%
echo ============================================================
echo Close the two server windows to stop it.
pause
