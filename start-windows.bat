@echo off
REM One-click start for Windows: installs dependencies, starts the API and web app, opens the browser.
cd /d "%~dp0"

where python >nul 2>nul || (echo Python 3.11+ is required: https://www.python.org/downloads/ & pause & exit /b 1)
where npm >nul 2>nul || (echo Node.js 20+ is required: https://nodejs.org/ & pause & exit /b 1)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)" || (echo Node.js 20 or newer is required. Install the LTS version from https://nodejs.org/ & pause & exit /b 1)

REM Another program on these ports would be opened instead of TalentBridge.
curl -s -o nul http://localhost:3000 && (
  echo.
  echo Port 3000 is already used by another program - probably another app or an old terminal window.
  echo Close it ^(or restart the computer^) and run this script again.
  pause & exit /b 1
)
curl -s -o nul http://localhost:8000 && (
  echo.
  echo Port 8000 is already used by another program. Close it ^(or restart the computer^) and run this script again.
  pause & exit /b 1
)

echo [1/3] Preparing backend...
if not exist backend\.venv python -m venv backend\.venv
backend\.venv\Scripts\python -m pip install -q -r backend\requirements.txt || (pause & exit /b 1)

echo [2/3] Preparing frontend (first run takes a few minutes)...
pushd frontend
call npm install --no-audit --no-fund || (popd & pause & exit /b 1)
popd

echo [3/3] Starting TalentBridge HR...
start "TalentBridge API (close to stop)" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\python -m uvicorn app.main:app --port 8000"
start "TalentBridge Web (close to stop)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Waiting for the app to start...
set /a tries=0
:wait
curl -s http://localhost:3000/api/health 2>nul | findstr /C:"TalentBridge" >nul && goto open
set /a tries+=1
if %tries% geq 90 (
  echo The app did not start. Check the two server windows for errors.
  pause & exit /b 1
)
timeout /t 2 /nobreak >nul
goto wait
:open
start "" http://localhost:3000
echo.
echo TalentBridge HR is running at http://localhost:3000
echo Close the two server windows to stop it.
pause
