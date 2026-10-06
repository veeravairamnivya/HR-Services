@echo off
setlocal
REM Puts the latest ABRAH Recruitment code into D:\ABRAH\HR, then starts it and opens the browser.
REM If the folder already has files, they are first copied to D:\ABRAH\HR-backup-<date>.
REM Your database (backend\hr_services.db) and installed packages are kept.
set "TARGET=D:\ABRAH\HR"
set "REPO=https://github.com/veeravairamnivya/HR-Services.git"
set "BRANCH=claude/hr-recruitment-app-7gnvcl"

where git >nul 2>nul || (echo Git is required. Install it from https://git-scm.com/download/win and run this file again. & pause & exit /b 1)

if not exist "%TARGET%\*" goto clone
dir /b "%TARGET%" | findstr . >nul || goto clone

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmm"') do set "STAMP=%%i"
set "BACKUP=%TARGET%-backup-%STAMP%"
echo Backing up the current folder to %BACKUP% ...
robocopy "%TARGET%" "%BACKUP%" /E /XD node_modules .venv .next /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (echo Backup failed - nothing was changed. & pause & exit /b 1)

echo Updating %TARGET% to the latest code ...
pushd "%TARGET%"
if not exist .git git init -q || goto fail
git remote get-url origin >nul 2>nul || git remote add origin %REPO%
git stash -u -q >nul 2>nul
git fetch %REPO% %BRANCH% || goto fail
git checkout -q -f -B %BRANCH% FETCH_HEAD || goto fail
popd
goto start

:clone
echo Downloading the project into %TARGET% ...
git clone -b %BRANCH% %REPO% "%TARGET%" || (echo Download failed. If asked, sign in with your GitHub account. & pause & exit /b 1)

:start
echo.
echo The latest code is in %TARGET%. Starting it now...
call "%TARGET%\start-windows.bat"
exit /b

:fail
popd
echo Update failed. Your previous files are safe in %BACKUP%.
pause
exit /b 1
